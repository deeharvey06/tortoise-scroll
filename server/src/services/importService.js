import { Readable } from 'stream';
import csvParser from 'csv-parser';
import Trade from '../models/Trade.js';
import ImportJob from '../models/ImportJob.js';
import BrokerExecution from '../models/BrokerExecution.js';
import { getAdapter } from '../utils/csvAdapters.js';
import { parseThinkorswimExecutions } from '../utils/thinkorswimParser.js';
import { computeRowHash } from '../utils/hash.js';
import { createTrade, updateTrade } from './tradeService.js';
import { enrichExecutionsWithInstrumentSpecifications } from './instrumentSpecificationService.js';
import {
  reconstructPositions,
  positionToTradePayload,
} from './positionReconstructionService.js';

const REQUIRED_TARGET_FIELDS = [
  'symbol',
  'direction',
  'quantity',
  'entryPrice',
  'entryTime',
];

export function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    Readable.from(buffer)
      .pipe(csvParser())
      .on('headers', (h) => {
        headers = h;
      })
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve({ headers: headers || [], rows }))
      .on('error', reject);
  });
}

export async function previewImport(
  buffer,
  brokerKey,
  { sourceTimezone = 'UTC' } = {}
) {
  const adapter = getAdapter(brokerKey);
  if (adapter.mode === 'execution' && brokerKey === 'thinkorswim') {
    const parsed = await parseThinkorswimExecutions(buffer, {
      broker: brokerKey,
      sourceTimeZone: sourceTimezone,
    });
    return {
      mode: 'execution',
      headers: parsed.headers,
      totalRows: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 10),
      suggestedMapping: adapter.defaultMapping,
      executionSummary: {
        executionsDetected: parsed.normalized.length,
        rejectedRows: parsed.errors.length,
        warnings: parsed.warnings.length,
      },
      validationErrors: parsed.errors.slice(0, 25),
      validationWarnings: parsed.warnings.slice(0, 25),
    };
  }

  const { headers, rows } = await parseCsvBuffer(buffer);
  return {
    mode: 'trade',
    headers,
    totalRows: rows.length,
    previewRows: rows.slice(0, 10),
    suggestedMapping: adapter.defaultMapping,
  };
}

function readMapped(row, mapping, targetField) {
  const column = mapping[targetField];
  if (!column) return undefined;
  return row[column];
}

function toNumber(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isNaN(n) ? undefined : n;
}

function toDate(v) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildRowPayload(row, mapping, adapter, accountId) {
  const errors = [];
  const symbol = readMapped(row, mapping, 'symbol');
  const rawDirection = readMapped(row, mapping, 'direction');
  const direction = adapter.parseDirection(rawDirection);
  const quantity = toNumber(readMapped(row, mapping, 'quantity'));
  const entryPrice = toNumber(readMapped(row, mapping, 'entryPrice'));
  const exitPrice = toNumber(readMapped(row, mapping, 'exitPrice'));
  const entryTime = toDate(readMapped(row, mapping, 'entryTime'));
  const exitTime = toDate(readMapped(row, mapping, 'exitTime'));
  const fees = toNumber(readMapped(row, mapping, 'fees')) ?? 0;
  const commission = toNumber(readMapped(row, mapping, 'commission')) ?? 0;
  const stopLoss = toNumber(readMapped(row, mapping, 'stopLoss'));
  const notes = readMapped(row, mapping, 'notes') || '';

  if (!symbol) errors.push('Missing symbol');
  if (!direction)
    errors.push(`Unrecognized or missing direction ("${rawDirection ?? ''}")`);
  if (quantity === undefined) errors.push('Missing or invalid quantity');
  if (entryPrice === undefined) errors.push('Missing or invalid entry price');
  if (!entryTime) errors.push('Missing or unparseable entry time');
  if (errors.length) return { payload: null, errors };

  const payload = {
    accountId,
    symbol: String(symbol).toUpperCase().trim(),
    direction,
    quantity,
    entryPrice,
    exitPrice: exitPrice ?? null,
    entryTime,
    exitTime: exitTime ?? null,
    fees,
    commission,
    stopLoss: stopLoss ?? null,
    notes,
    isDemoData: false,
  };
  payload.sourceRowHash = computeRowHash(payload);
  return { payload, errors: [] };
}

async function commitLegacyTradeImport({
  accountId,
  broker,
  mapping,
  buffer,
  originalFilename,
  userId,
}) {
  const adapter = getAdapter(broker);
  const effectiveMapping = { ...adapter.defaultMapping, ...mapping };
  for (const field of REQUIRED_TARGET_FIELDS) {
    if (!effectiveMapping[field])
      throw new Error(`Column mapping is missing a required field: "${field}"`);
  }
  const { rows } = await parseCsvBuffer(buffer);
  const jobRows = [];
  let imported = 0;
  let duplicates = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2;
    const { payload, errors } = buildRowPayload(
      rows[i],
      effectiveMapping,
      adapter,
      accountId
    );
    if (errors.length) {
      errorCount += 1;
      jobRows.push({ rowNumber, outcome: 'error', message: errors.join('; ') });
      continue;
    }
    const existing = await Trade.findOne({
      userId,
      accountId,
      sourceRowHash: payload.sourceRowHash,
    }).lean();
    if (existing) {
      duplicates += 1;
      jobRows.push({
        rowNumber,
        outcome: 'duplicate',
        message: `Matches existing trade ${existing._id}`,
        tradeId: existing._id,
      });
      continue;
    }
    try {
      const trade = await createTrade(payload, userId);
      imported += 1;
      jobRows.push({
        rowNumber,
        outcome: 'imported',
        message: 'Imported',
        tradeId: trade._id,
      });
    } catch (err) {
      errorCount += 1;
      jobRows.push({ rowNumber, outcome: 'error', message: err.message });
    }
  }

  const job = await ImportJob.create({
    userId,
    accountId,
    broker,
    originalFilename,
    status: 'completed',
    mode: 'trade',
    mapping: effectiveMapping,
    summary: {
      totalRows: rows.length,
      imported,
      duplicates,
      errors: errorCount,
    },
    rows: jobRows,
  });
  await Trade.updateMany(
    {
      userId,
      _id: {
        $in: jobRows
          .filter((r) => r.tradeId && r.outcome === 'imported')
          .map((r) => r.tradeId),
      },
    },
    { $set: { importBatchId: job._id } }
  );
  return job.toObject();
}

async function persistExecutionLedger({ parsed, accountId, userId }) {
  const outcomes = [];
  let inserted = 0;
  let duplicates = 0;

  for (const execution of parsed.normalized) {
    try {
      await BrokerExecution.create({ ...execution, accountId, userId });
      inserted += 1;
      outcomes.push({
        rowNumber: execution.rawRowNumber,
        outcome: 'execution_imported',
        message: 'Execution added to ledger',
        executionKey: execution.executionKey,
      });
    } catch (err) {
      if (err?.code === 11000) {
        duplicates += 1;
        outcomes.push({
          rowNumber: execution.rawRowNumber,
          outcome: 'duplicate',
          message: 'Duplicate execution skipped',
          executionKey: execution.executionKey,
        });
      } else {
        outcomes.push({
          rowNumber: execution.rawRowNumber,
          outcome: 'error',
          message: err.message,
          executionKey: execution.executionKey,
        });
      }
    }
  }
  return { outcomes, inserted, duplicates };
}

async function reconcileReconstructedTrades({
  accountId,
  broker,
  userId,
  importJobId,
}) {
  const ledger = await BrokerExecution.find({
    userId,
    accountId,
    broker,
    status: { $nin: ['cancelled', 'rejected'] },
  })
    .sort({ timestamp: 1, executionKey: 1 })
    .lean();
  const { positions, openPositions, warnings } = reconstructPositions(ledger, {
    policy: 'fifo',
  });
  let created = 0;
  let updated = 0;
  const tradeIds = [];

  for (const position of positions) {
    const payload = positionToTradePayload(position, accountId);
    const existing = await Trade.findOne({
      userId,
      accountId,
      sourcePositionKey: position.sourcePositionKey,
    });
    let trade;
    if (existing) {
      trade = await updateTrade(existing._id, payload, userId);
      updated += 1;
    } else {
      trade = await createTrade(
        { ...payload, importBatchId: importJobId },
        userId
      );
      created += 1;
    }
    tradeIds.push(trade._id);
    const sourceKeys = new Set(
      position.executions.map((e) => e.sourceExecutionKey || e.executionKey)
    );
    await BrokerExecution.updateMany(
      { userId, accountId, broker, executionKey: { $in: [...sourceKeys] } },
      { $set: { tradeId: trade._id, importJobId } }
    );
  }
  return {
    created,
    updated,
    total: positions.length,
    openPositions: openPositions.length,
    warnings,
    tradeIds,
  };
}

async function commitThinkorswimExecutionImport({
  accountId,
  broker,
  buffer,
  originalFilename,
  userId,
  sourceTimezone = 'UTC',
}) {
  const parsed = await parseThinkorswimExecutions(buffer, {
    broker,
    sourceTimeZone: sourceTimezone,
  });
  const executionsDetected = parsed.normalized.length;
  const enrichment = await enrichExecutionsWithInstrumentSpecifications(
    userId,
    parsed.normalized
  );
  parsed.normalized = enrichment.accepted;
  for (const rejected of enrichment.rejected) {
    parsed.errors.push({
      rowNumber: rejected.execution?.rawRowNumber ?? null,
      message: rejected.message,
      raw: rejected.execution?.rawBrokerMetadata || null,
    });
  }
  const initialRows = [
    ...parsed.errors.map((e) => ({
      rowNumber: e.rowNumber,
      outcome: 'error',
      message: e.message,
    })),
    ...parsed.warnings.map((w) => ({
      rowNumber: w.rowNumber,
      outcome: 'warning',
      message: w.message,
    })),
  ];
  const ledgerResult = await persistExecutionLedger({
    parsed,
    accountId,
    userId,
  });

  const job = await ImportJob.create({
    userId,
    accountId,
    broker,
    originalFilename,
    status: 'completed',
    mode: 'execution',
    reconstructionPolicy: 'fifo',
    sourceTimezone,
    mapping: getAdapter(broker).defaultMapping,
    summary: {
      totalRows: parsed.rows.length,
      imported: 0,
      duplicates: ledgerResult.duplicates,
      errors:
        parsed.errors.length +
        ledgerResult.outcomes.filter((r) => r.outcome === 'error').length,
      executionsDetected,
      executionsImported: ledgerResult.inserted,
      tradesReconstructed: 0,
      tradesUpdated: 0,
      openPositions: 0,
      warnings: parsed.warnings.length,
      rejectedRows: parsed.errors.length,
    },
    rows: [...initialRows, ...ledgerResult.outcomes],
  });

  const executionKeys = parsed.normalized.map((e) => e.executionKey);
  if (executionKeys.length) {
    await BrokerExecution.updateMany(
      { userId, accountId, broker, executionKey: { $in: executionKeys } },
      {
        $addToSet: {
          sources: {
            sourceType: 'csv',
            importJobId: job._id,
            brokerConnectionId: null,
          },
        },
      }
    );
  }

  const reconstruction = await reconcileReconstructedTrades({
    accountId,
    broker,
    userId,
    importJobId: job._id,
  });
  job.summary.imported = reconstruction.created;
  job.summary.tradesReconstructed = reconstruction.created;
  job.summary.tradesUpdated = reconstruction.updated;
  job.summary.openPositions = reconstruction.openPositions;
  job.summary.warnings += reconstruction.warnings.length;
  for (const warning of reconstruction.warnings)
    job.rows.push({ outcome: 'warning', message: warning });
  await job.save();
  return job.toObject();
}

export async function commitImport(args) {
  const adapter = getAdapter(args.broker);
  if (adapter.mode === 'execution' && args.broker === 'thinkorswim') {
    return commitThinkorswimExecutionImport(args);
  }
  return commitLegacyTradeImport(args);
}

export default { previewImport, commitImport };
