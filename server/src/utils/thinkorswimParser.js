import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { normalizeExecution } from '../services/executionNormalizationService.js';

const TRADE_HEADER_MARKERS = ['Exec Time', 'Side', 'Qty', 'Symbol', 'Price'];

function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];
    Readable.from(Buffer.from(text))
      .pipe(csvParser())
      .on('headers', (h) => {
        headers = h;
      })
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve({ headers, rows }))
      .on('error', reject);
  });
}

function looksLikeTradeHeader(line) {
  return TRADE_HEADER_MARKERS.every((marker) => line.includes(marker));
}

function isSectionBoundary(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  return /^(Account Summary|Cash & Sweep Vehicle|Forex Account Summary|Profits and Losses|Order History|Trade History|Equities|Options|Futures|Forex|Balances|Cash Balance)/i.test(
    trimmed.replace(/^"|"$/g, '')
  );
}

export function extractThinkorswimTradeSection(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(looksLikeTradeHeader);
  if (headerIndex < 0) return null;

  const section = [lines[headerIndex]];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSectionBoundary(line)) break;
    section.push(line);
  }
  return section.join('\n');
}

function first(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  return undefined;
}

function parseNaiveParts(value) {
  const match = String(value || '')
    .trim()
    .match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );
  if (!match) return null;
  return {
    year: Number(match[3]),
    month: Number(match[1]),
    day: Number(match[2]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };
}

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)])
  );
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function parseThinkorswimTimestamp(value, sourceTimeZone = 'UTC') {
  if (!value) return null;
  const literal = String(value).trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(literal)) return new Date(literal);
  const desired = parseNaiveParts(literal);
  if (!desired) return new Date(literal);
  try {
    // Convert an account-local wall clock into an absolute instant without
    // depending on the server machine's timezone. Iterate once to account
    // for DST offset changes around the candidate instant.
    const desiredUtc = Date.UTC(
      desired.year,
      desired.month - 1,
      desired.day,
      desired.hour,
      desired.minute,
      desired.second
    );
    let candidate = new Date(desiredUtc);
    for (let i = 0; i < 2; i += 1) {
      const actual = partsInZone(candidate, sourceTimeZone);
      const actualUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second
      );
      candidate = new Date(candidate.getTime() + (desiredUtc - actualUtc));
    }
    return candidate;
  } catch {
    return new Date(NaN);
  }
}

export async function parseThinkorswimExecutions(
  buffer,
  { broker = 'thinkorswim', sourceTimeZone = 'UTC' } = {}
) {
  const section = extractThinkorswimTradeSection(buffer);
  if (!section) {
    return {
      headers: [],
      rows: [],
      normalized: [],
      errors: [
        {
          rowNumber: null,
          message: 'Thinkorswim Trade History execution section was not found',
        },
      ],
      warnings: [],
    };
  }

  const { headers, rows } = await parseCsvText(section);
  const normalized = [];
  const errors = [];
  const warnings = [];
  const executionKeyOccurrences = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = {
      broker,
      account: first(row, ['Account', 'Account #', 'Acct']),
      executionId: first(row, ['Exec ID', 'Execution ID', 'ExecId']),
      orderId: first(row, ['Order ID', 'OrderId', 'Order #']),
      symbol: first(row, ['Symbol']),
      spread: first(row, ['Spread']),
      side: first(row, ['Side']),
      quantity: first(row, ['Qty', 'Quantity']),
      price: first(row, ['Price', 'Exec Price']),
      timestamp: parseThinkorswimTimestamp(
        first(row, ['Exec Time', 'Execution Time', 'Date/Time']),
        sourceTimeZone
      ),
      commission: first(row, ['Commission', 'Commissions']),
      fees: first(row, ['Misc Fees', 'Fees', 'Reg Fee']),
      multiplier: first(row, ['Multiplier']),
      expiration: first(row, ['Exp', 'Expiration']),
      strike: first(row, ['Strike']),
      optionType: first(row, ['Type', 'Call/Put', 'Put/Call']),
      positionEffect: first(row, ['Pos Effect', 'Position Effect']),
      status: first(row, ['Status']),
      rawBrokerMetadata: row,
      rawRowNumber: rowNumber,
    };
    const result = normalizeExecution(raw);
    if (result.execution) {
      if (result.execution.executionKey.startsWith('hash:')) {
        const baseKey = result.execution.executionKey;
        const occurrence = (executionKeyOccurrences.get(baseKey) || 0) + 1;
        executionKeyOccurrences.set(baseKey, occurrence);
        if (occurrence > 1)
          result.execution.executionKey = `${baseKey}:occurrence:${occurrence}`;
      }
      normalized.push(result.execution);
    }
    if (result.errors.length) {
      errors.push({ rowNumber, message: result.errors.join('; '), raw: row });
    }
    for (const warning of result.warnings)
      warnings.push({ rowNumber, message: warning });
  });

  return { headers, rows, normalized, errors, warnings };
}

export default {
  extractThinkorswimTradeSection,
  parseThinkorswimExecutions,
  parseThinkorswimTimestamp,
};
