import { Readable } from 'stream';
import csvParser from 'csv-parser';
import Trade from '../models/Trade.js';
import ImportJob from '../models/ImportJob.js';
import { getAdapter } from '../utils/csvAdapters.js';
import { computeRowHash } from '../utils/hash.js';
import { createTrade } from './tradeService.js';

const REQUIRED_TARGET_FIELDS = ['symbol', 'direction', 'quantity', 'entryPrice', 'entryTime'];

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

/**
 * Returns headers + a small preview of parsed rows, plus the suggested
 * default mapping for the chosen broker adapter (the user edits this
 * before committing — never applied blindly).
 */
export async function previewImport(buffer, brokerKey) {
  const { headers, rows } = await parseCsvBuffer(buffer);
  const adapter = getAdapter(brokerKey);
  return {
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

/**
 * Builds a candidate trade payload from one CSV row using the given
 * mapping/adapter, and returns { payload, errors }. Never throws for a bad
 * row — errors are collected so the row can be reported, not discarded
 * silently.
 */
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
  if (!direction) errors.push(`Unrecognized or missing direction ("${rawDirection ?? ''}")`);
  if (quantity === undefined) errors.push('Missing or invalid quantity');
  if (entryPrice === undefined) errors.push('Missing or invalid entry price');
  if (!entryTime) errors.push('Missing or unparseable entry time');

  if (errors.length > 0) return { payload: null, errors };

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

/**
 * Processes the full CSV synchronously (appropriate for personal-use
 * broker exports) and returns a saved ImportJob with a per-row outcome —
 * imported / duplicate / error — so nothing is ever silently dropped.
 */
export async function commitImport({ accountId, broker, mapping, buffer, originalFilename, userId }) {
  const adapter = getAdapter(broker);
  const effectiveMapping = { ...adapter.defaultMapping, ...mapping };

  for (const field of REQUIRED_TARGET_FIELDS) {
    if (!effectiveMapping[field]) {
      throw new Error(`Column mapping is missing a required field: "${field}"`);
    }
  }

  const { rows } = await parseCsvBuffer(buffer);

  const jobRows = [];
  let imported = 0;
  let duplicates = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 2; // account for header row, 1-indexed data rows
    const row = rows[i];

    const { payload, errors } = buildRowPayload(row, effectiveMapping, adapter, accountId);

    if (errors.length > 0) {
      errorCount += 1;
      jobRows.push({ rowNumber, outcome: 'error', message: errors.join('; ') });
      continue;
    }

    const existing = await Trade.findOne({ userId, accountId, sourceRowHash: payload.sourceRowHash }).lean();
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
      jobRows.push({ rowNumber, outcome: 'imported', message: 'Imported', tradeId: trade._id });
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
    mapping: effectiveMapping,
    summary: { totalRows: rows.length, imported, duplicates, errors: errorCount },
    rows: jobRows,
  });

  // Tag every imported trade with its import batch for provenance/audit
  await Trade.updateMany(
    { userId, _id: { $in: jobRows.filter((r) => r.tradeId && r.outcome === 'imported').map((r) => r.tradeId) } },
    { $set: { importBatchId: job._id } }
  );

  return job.toObject();
}

export default { previewImport, commitImport };
