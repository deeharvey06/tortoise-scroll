import { normalizeTimestamp } from './time.js';
import { expectedSlots } from './calendar.js';
import { fail } from './errors.js';

function number(value, field, row) {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(
      String(value).trim()
    ) ||
    !Number.isFinite(Number(value))
  )
    fail(
      'MARKET_DATA_INVALID_CANDLE',
      `Row ${row}: ${field} must be a finite number.`
    );
  return Number(value);
}

export function normalizeCandles(rows, dataset) {
  const slots = new Map(
    expectedSlots(dataset.calendar, dataset.timeframe).map((slot) => [
      slot.timestamp,
      slot,
    ])
  );
  const unique = new Map();
  let duplicates = 0;
  let outOfOrder = false;
  let previous;
  rows.forEach((row, index) => {
    const timestamp = normalizeTimestamp(row.timestamp, dataset);
    if (previous && timestamp < previous) outOfOrder = true;
    previous = timestamp;
    const slot = slots.get(timestamp);
    if (!slot)
      fail(
        'MARKET_DATA_OUTSIDE_SESSION',
        `Row ${index + 2}: candle start is outside the declared calendar or bar grid.`
      );
    const open = number(row.open, 'open', index + 2);
    const high = number(row.high, 'high', index + 2);
    const low = number(row.low, 'low', index + 2);
    const close = number(row.close, 'close', index + 2);
    const volume =
      row.volume == null || row.volume === ''
        ? null
        : number(row.volume, 'volume', index + 2);
    if (
      low > high ||
      open < low ||
      open > high ||
      close < low ||
      close > high ||
      (volume !== null && volume < 0)
    )
      fail(
        'MARKET_DATA_INVALID_CANDLE',
        `Row ${index + 2}: inconsistent OHLC or negative volume.`
      );
    const candle = {
      symbol: dataset.symbol,
      timeframe: dataset.timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      timezone: dataset.timezone,
      session: slot.session,
      tradingDate: slot.tradingDate,
    };
    const existing = unique.get(timestamp);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(candle))
        fail(
          'MARKET_DATA_CONFLICTING_DUPLICATE',
          `Conflicting candles at ${timestamp}.`
        );
      duplicates++;
    } else unique.set(timestamp, candle);
  });
  const warnings = [];
  if (duplicates)
    warnings.push({ code: 'IDENTICAL_DUPLICATES_REMOVED', count: duplicates });
  if (outOfOrder) warnings.push({ code: 'OUT_OF_ORDER_SORTED' });
  return {
    candles: [...unique.values()].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    ),
    warnings,
  };
}

export function selectRange(normalized, dataset, { from, to, session }) {
  const expected = expectedSlots(
    dataset.calendar,
    dataset.timeframe,
    session
  ).filter((slot) => slot.timestamp >= from && slot.timestamp < to);
  const wanted = new Set(expected.map((slot) => slot.timestamp));
  const candles = normalized.candles.filter((candle) =>
    wanted.has(candle.timestamp)
  );
  const actual = new Set(candles.map((candle) => candle.timestamp));
  const missing = expected
    .filter((slot) => !actual.has(slot.timestamp))
    .map((slot) => slot.timestamp);
  const overlapsSession = dataset.calendar.sessions.some(
    (window) =>
      (session === 'all' || window.kind === session) &&
      window.start < to &&
      window.end > from
  );
  return {
    state: !expected.length
      ? overlapsSession
        ? 'empty'
        : 'closed'
      : !candles.length
        ? 'unavailable'
        : missing.length
          ? 'partial'
          : 'available',
    candles,
    diagnostics: {
      expectedBars: expected.length,
      actualBars: candles.length,
      missingBars: missing.length,
      missingTimestamps: missing,
      warnings: normalized.warnings,
    },
  };
}
