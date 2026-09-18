import { Temporal } from '@js-temporal/polyfill';
import { fail } from './errors.js';

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{1,3})?$/;
const OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function validateTimezone(timezone) {
  try {
    if (typeof timezone !== 'string' || /^[+-]/.test(timezone))
      throw new Error();
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(timezone);
    return timezone;
  } catch {
    fail(
      'MARKET_DATA_INVALID_TIMEZONE',
      'An explicit IANA timezone is required.'
    );
  }
}

// Wall-clock gaps and folds MUST be disambiguated by an offset in the source,
// never by the server timezone or an automatic earlier/later choice.
export function normalizeTimestamp(
  value,
  { timestampFormat = 'offset', timezone } = {}
) {
  try {
    if (value instanceof Date) value = value.toISOString();
    if (typeof value !== 'string') throw new Error();
    let instant;
    if (timestampFormat === 'local') {
      if (!LOCAL.test(value)) throw new Error();
      validateTimezone(timezone);
      instant = Temporal.PlainDateTime.from(value, { overflow: 'reject' })
        .toZonedDateTime(timezone, { disambiguation: 'reject' })
        .toInstant();
    } else {
      if (timestampFormat !== 'offset' || !OFFSET.test(value))
        throw new Error();
      instant = Temporal.Instant.from(value);
    }
    return instant.toString({ fractionalSecondDigits: 3 });
  } catch {
    fail(
      'MARKET_DATA_INVALID_TIMESTAMP',
      'Invalid or ambiguous timestamp; supply an ISO timestamp with an explicit offset, or an unambiguous local timestamp and IANA timezone.'
    );
  }
}

export function validateTradingDate(value) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error();
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return value;
  } catch {
    fail('MARKET_DATA_INVALID_CALENDAR', 'Invalid calendar trading date.');
  }
}

export const TIMEFRAMES = Object.freeze({
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': null,
});
export const SESSION_KINDS = ['rth', 'premarket', 'postmarket', 'eth'];
export const MAX_BARS = 100_000;

export function normalizeSymbol(symbol) {
  if (
    typeof symbol !== 'string' ||
    !/^[A-Z0-9/._:-]{1,64}$/i.test(symbol.trim())
  )
    fail('MARKET_DATA_INVALID_SYMBOL', 'A valid symbol is required.', 400);
  // Preserve expiry and continuous-contract identifiers: never infer a roll.
  return symbol.trim().toUpperCase();
}
