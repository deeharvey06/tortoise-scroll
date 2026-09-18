import {
  normalizeTimestamp,
  validateTradingDate,
  TIMEFRAMES,
  MAX_BARS,
} from './time.js';
import { fail } from './errors.js';

export function normalizeCalendar(calendar, timezone) {
  const from = normalizeTimestamp(calendar.from);
  const to = normalizeTimestamp(calendar.to);
  if (from >= to)
    fail(
      'MARKET_DATA_INVALID_CALENDAR',
      'Calendar coverage must be a non-empty half-open interval.'
    );
  const sessions = calendar.sessions
    .map((session) => {
      const options = { timestampFormat: calendar.timestampFormat, timezone };
      const start = normalizeTimestamp(session.start, options);
      const end = normalizeTimestamp(session.end, options);
      if (start >= end || start < from || end > to)
        fail(
          'MARKET_DATA_INVALID_CALENDAR',
          'Session windows must lie within calendar coverage.'
        );
      return {
        kind: session.kind,
        tradingDate: validateTradingDate(session.tradingDate),
        start,
        end,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i].start < sessions[i - 1].end)
      fail('MARKET_DATA_INVALID_CALENDAR', 'Session windows must not overlap.');
    if (sessions[i].tradingDate < sessions[i - 1].tradingDate)
      fail(
        'MARKET_DATA_INVALID_CALENDAR',
        'Trading dates must follow session chronology.'
      );
  }
  return { from, to, sessions };
}

// Daily bars represent ONE trading date, at its first listed session open.
// Intraday bars start at session open + n*duration; final bars may end at close.
export function expectedSlots(calendar, timeframe, session = 'all') {
  const slots = [];
  if (timeframe === '1d') {
    if (session !== 'all')
      fail(
        'MARKET_DATA_UNSUPPORTED_SESSION',
        'Daily datasets do not support filtering constituent sessions.',
        400
      );
    const dates = new Map();
    for (const window of calendar.sessions) {
      if (!dates.has(window.tradingDate)) dates.set(window.tradingDate, window);
    }
    for (const window of dates.values())
      slots.push({
        timestamp: window.start,
        session: 'daily',
        tradingDate: window.tradingDate,
      });
  } else {
    for (const window of calendar.sessions) {
      if (session !== 'all' && window.kind !== session) continue;
      for (
        let ms = Date.parse(window.start);
        ms < Date.parse(window.end);
        ms += TIMEFRAMES[timeframe]
      ) {
        if (slots.length >= MAX_BARS)
          fail(
            'MARKET_DATA_LIMIT_EXCEEDED',
            'Calendar exceeds the supported bar limit.',
            413
          );
        slots.push({
          timestamp: new Date(ms).toISOString(),
          session: window.kind,
          tradingDate: window.tradingDate,
        });
      }
    }
  }
  return slots;
}
