import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTimestamp,
  normalizeSymbol,
  validateTimezone,
} from '../src/services/marketData/time.js';
import {
  normalizeCalendar,
  expectedSlots,
} from '../src/services/marketData/calendar.js';
import {
  normalizeCandles,
  selectRange,
} from '../src/services/marketData/normalizer.js';
import { dataset } from './fixtures/market-data/helpers.js';

const metadata = (overrides = {}) => {
  const item = dataset(overrides);
  return { ...item, calendar: normalizeCalendar(item.calendar, item.timezone) };
};
const row = (overrides = {}) => ({
  timestamp: '2026-03-09T13:30:00Z',
  open: '100',
  high: '102',
  low: '99',
  close: '101',
  ...overrides,
});
const code = (expected) => (error) => error.code === expected;

test('timestamps normalize explicit offsets and Dates to the same UTC instant', () => {
  const expected = '2026-03-09T13:30:00.000Z';
  for (const value of [
    '2026-03-09T09:30:00-04:00',
    expected,
    new Date(expected),
  ])
    assert.equal(normalizeTimestamp(value), expected);
});

test('exchange local session opens follow DST, not the server timezone', () => {
  const options = { timestampFormat: 'local', timezone: 'America/New_York' };
  assert.equal(
    normalizeTimestamp('2026-03-06T09:30:00', options),
    '2026-03-06T14:30:00.000Z'
  );
  assert.equal(
    normalizeTimestamp('2026-03-09T09:30:00', options),
    '2026-03-09T13:30:00.000Z'
  );
  assert.equal(
    normalizeTimestamp('2026-11-02T09:30:00', options),
    '2026-11-02T14:30:00.000Z'
  );
});

for (const value of ['2026-03-08T02:30:00', '2026-11-01T01:30:00']) {
  test(`rejects DST gap/fold ${value} without an offset`, () => {
    assert.throws(
      () =>
        normalizeTimestamp(value, {
          timestampFormat: 'local',
          timezone: 'America/New_York',
        }),
      code('MARKET_DATA_INVALID_TIMESTAMP')
    );
  });
}

test('both repeated autumn wall-clock times remain distinct with explicit offsets', () => {
  assert.equal(
    normalizeTimestamp('2026-11-01T01:30:00-04:00'),
    '2026-11-01T05:30:00.000Z'
  );
  assert.equal(
    normalizeTimestamp('2026-11-01T01:30:00-05:00'),
    '2026-11-01T06:30:00.000Z'
  );
});

for (const value of [
  '',
  null,
  0,
  '2026-02-30T00:00:00Z',
  '2026-03-09',
  '2026-03-09T13:30:00',
  '2026-03-09T13:30:60Z',
  '2026-03-09T25:00:00Z',
  '03/09/2026 09:30',
]) {
  test(`rejects malformed/implicit timestamp ${JSON.stringify(value)}`, () =>
    assert.throws(
      () => normalizeTimestamp(value),
      code('MARKET_DATA_INVALID_TIMESTAMP')
    ));
}

test('timezones and local formatting must be explicit', () => {
  for (const zone of [undefined, 'Invalid/Zone', '+05:00'])
    assert.throws(
      () => validateTimezone(zone),
      code('MARKET_DATA_INVALID_TIMEZONE')
    );
  assert.equal(validateTimezone('UTC'), 'UTC');
  assert.throws(
    () =>
      normalizeTimestamp('2026-03-09T13:30:00Z', {
        timestampFormat: 'local',
        timezone: 'UTC',
      }),
    code('MARKET_DATA_INVALID_TIMESTAMP')
  );
  assert.throws(
    () =>
      normalizeTimestamp('2026-03-09T13:30:00', {
        timestampFormat: 'local',
        timezone: 'Bad',
      }),
    code('MARKET_DATA_INVALID_TIMESTAMP')
  );
});

test('symbol normalization preserves expiry, separators, and continuous identifiers', () => {
  assert.equal(normalizeSymbol(' /esu26 '), '/ESU26');
  assert.equal(normalizeSymbol('es'), 'ES');
  for (const symbol of ['', null, 'a b', 'X'.repeat(65)])
    assert.throws(
      () => normalizeSymbol(symbol),
      code('MARKET_DATA_INVALID_SYMBOL')
    );
});

test('sorts out-of-order rows and reports identical duplicates without manufacturing volume', () => {
  const result = normalizeCandles(
    [row({ timestamp: '2026-03-09T13:31:00Z', volume: '0' }), row(), row()],
    metadata()
  );
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[0].volume, null);
  assert.equal(result.candles[1].volume, 0);
  assert.equal(result.candles[0].session, 'rth');
  assert.equal(result.candles[0].tradingDate, '2026-03-09');
  assert.deepEqual(result.warnings, [
    { code: 'IDENTICAL_DUPLICATES_REMOVED', count: 1 },
    { code: 'OUT_OF_ORDER_SORTED' },
  ]);
});

test('conflicting duplicate OHLC or volume is a hard failure', () => {
  for (const duplicate of [row({ close: '100' }), row({ volume: '1' })])
    assert.throws(
      () => normalizeCandles([row(), duplicate], metadata()),
      code('MARKET_DATA_CONFLICTING_DUPLICATE')
    );
});

for (const invalid of [
  { open: '' },
  { high: 'NaN' },
  { low: 'Infinity' },
  { close: true },
  { high: '98' },
  { low: '103' },
  { open: '104' },
  { close: '98' },
  { volume: '-1' },
]) {
  test(`rejects malformed OHLCV ${JSON.stringify(invalid)}`, () =>
    assert.throws(
      () => normalizeCandles([row(invalid)], metadata()),
      code('MARKET_DATA_INVALID_CANDLE')
    ));
}

test('accepts finite negative/zero prices rather than assuming every asset is positive', () => {
  const result = normalizeCandles(
    [row({ open: '-2', high: '0', low: '-3', close: '-1', volume: '' })],
    metadata()
  );
  assert.equal(result.candles[0].open, -2);
  assert.equal(result.candles[0].volume, null);
});

test('rejects bars outside declared session and misaligned starts', () => {
  for (const timestamp of ['2026-03-09T13:30:01Z', '2026-03-09T13:33:00Z'])
    assert.throws(
      () => normalizeCandles([row({ timestamp })], metadata()),
      code('MARKET_DATA_OUTSIDE_SESSION')
    );
});

test('reports leading, middle and trailing missing bars without filling them', () => {
  const item = metadata();
  const from = item.calendar.from;
  const to = item.calendar.to;
  for (const minute of ['30', '31', '32']) {
    const normalized = normalizeCandles(
      [row({ timestamp: `2026-03-09T13:${minute}:00Z` })],
      item
    );
    const result = selectRange(normalized, item, { from, to, session: 'all' });
    assert.equal(result.state, 'partial');
    assert.equal(result.diagnostics.missingBars, 2);
    assert.equal(result.candles.length, 1);
  }
  assert.equal(
    selectRange(normalizeCandles([], item), item, { from, to, session: 'all' })
      .state,
    'unavailable'
  );
});

test('explicit premarket, RTH and postmarket windows support session filtering', () => {
  const item = dataset();
  item.calendar.sessions = [
    {
      tradingDate: '2026-03-09',
      kind: 'premarket',
      start: item.calendar.from,
      end: '2026-03-09T13:31:00Z',
    },
    {
      tradingDate: '2026-03-09',
      kind: 'rth',
      start: '2026-03-09T13:31:00Z',
      end: '2026-03-09T13:32:00Z',
    },
    {
      tradingDate: '2026-03-09',
      kind: 'postmarket',
      start: '2026-03-09T13:32:00Z',
      end: item.calendar.to,
    },
  ];
  const calendar = normalizeCalendar(item.calendar, item.timezone);
  assert.equal(expectedSlots(calendar, '1m').length, 3);
  for (const session of ['rth', 'premarket', 'postmarket']) {
    const slots = expectedSlots(calendar, '1m', session);
    assert.equal(slots.length, 1);
    assert.equal(slots[0].session, session);
  }
});

test('explicit overnight futures windows retain trading date and exclude maintenance/closures', () => {
  const calendar = normalizeCalendar(
    {
      from: '2026-03-08T00:00:00Z',
      to: '2026-03-10T00:00:00Z',
      timestampFormat: 'local',
      sessions: [
        {
          tradingDate: '2026-03-09',
          kind: 'eth',
          start: '2026-03-08T17:00:00',
          end: '2026-03-09T16:00:00',
        },
      ],
    },
    'America/Chicago'
  );
  const slots = expectedSlots(calendar, '1h');
  assert.equal(slots.length, 23);
  assert.equal(slots[0].timestamp, '2026-03-08T22:00:00.000Z');
  assert.ok(slots.every((slot) => slot.tradingDate === '2026-03-09'));
  assert.equal(expectedSlots(calendar, '1d')[0].timestamp, slots[0].timestamp);
  assert.throws(
    () => expectedSlots(calendar, '1d', 'rth'),
    code('MARKET_DATA_UNSUPPORTED_SESSION')
  );
});

test('declared closed days and early closes are not reported as missing bars', () => {
  const item = metadata();
  const result = selectRange(
    { candles: [], warnings: [] },
    { ...item, calendar: { ...item.calendar, sessions: [] } },
    { from: item.calendar.from, to: item.calendar.to, session: 'all' }
  );
  assert.equal(result.state, 'closed');
  assert.equal(result.diagnostics.missingBars, 0);
  // A shortened three-minute session produces one final partial five-minute bar.
  assert.equal(expectedSlots(item.calendar, '5m').length, 1);
});

for (const transform of [
  (c) => ({ ...c, to: c.from }),
  (c) => ({ ...c, sessions: [...c.sessions, c.sessions[0]] }),
  (c) => ({
    ...c,
    sessions: [{ ...c.sessions[0], end: '2026-03-09T14:00:00Z' }],
  }),
  (c) => ({
    ...c,
    sessions: [{ ...c.sessions[0], tradingDate: '2026-02-30' }],
  }),
]) {
  test('rejects inconsistent or overlapping calendar coverage', () =>
    assert.throws(
      () => normalizeCalendar(transform(dataset().calendar), 'UTC'),
      code('MARKET_DATA_INVALID_CALENDAR')
    ));
}

test('calendar expansion is bounded', () => {
  const calendar = normalizeCalendar(
    {
      from: '2026-01-01T00:00:00Z',
      to: '2027-01-01T00:00:00Z',
      timestampFormat: 'offset',
      sessions: [
        {
          tradingDate: '2026-01-01',
          kind: 'eth',
          start: '2026-01-01T00:00:00Z',
          end: '2027-01-01T00:00:00Z',
        },
      ],
    },
    'UTC'
  );
  assert.throws(
    () => expectedSlots(calendar, '1m'),
    code('MARKET_DATA_LIMIT_EXCEEDED')
  );
});

test('invalid Date objects and non-decimal numeric formats are rejected', () => {
  assert.throws(
    () => normalizeTimestamp(new Date('invalid')),
    code('MARKET_DATA_INVALID_TIMESTAMP')
  );
  for (const open of ['0x64', '0b1100100', ' ', undefined])
    assert.throws(
      () => normalizeCandles([row({ open })], metadata()),
      code('MARKET_DATA_INVALID_CANDLE')
    );
});

test('an open-session sub-bar request is empty, not a closed market or a fabricated bar', () => {
  const item = metadata();
  const result = selectRange(normalizeCandles([row()], item), item, {
    from: '2026-03-09T13:30:01.000Z',
    to: '2026-03-09T13:30:59.000Z',
    session: 'all',
  });
  assert.equal(result.state, 'empty');
  assert.equal(result.candles.length, 0);
  assert.equal(result.diagnostics.missingBars, 0);
});

test('daily bars group multiple session segments once and preserve different trading dates', () => {
  const calendar = normalizeCalendar(
    {
      from: '2026-03-09T00:00:00Z',
      to: '2026-03-11T00:00:00Z',
      timestampFormat: 'offset',
      sessions: [
        {
          tradingDate: '2026-03-09',
          kind: 'premarket',
          start: '2026-03-09T12:00:00Z',
          end: '2026-03-09T13:30:00Z',
        },
        {
          tradingDate: '2026-03-09',
          kind: 'rth',
          start: '2026-03-09T13:30:00Z',
          end: '2026-03-09T20:00:00Z',
        },
        {
          tradingDate: '2026-03-10',
          kind: 'rth',
          start: '2026-03-10T13:30:00Z',
          end: '2026-03-10T17:00:00Z',
        },
      ],
    },
    'America/New_York'
  );
  assert.deepEqual(expectedSlots(calendar, '1d'), [
    {
      timestamp: '2026-03-09T12:00:00.000Z',
      endTimestamp: '2026-03-09T20:00:00.000Z',
      session: 'daily',
      tradingDate: '2026-03-09',
    },
    {
      timestamp: '2026-03-10T13:30:00.000Z',
      endTimestamp: '2026-03-10T17:00:00.000Z',
      session: 'daily',
      tradingDate: '2026-03-10',
    },
  ]);
  const changed = {
    ...calendar,
    timestampFormat: 'offset',
    sessions: calendar.sessions.map((window, index) => ({
      ...window,
      tradingDate: index === 2 ? '2026-03-08' : window.tradingDate,
    })),
  };
  assert.throws(
    () => normalizeCalendar(changed, 'UTC'),
    code('MARKET_DATA_INVALID_CALENDAR')
  );
});

test('canonical candle close times honor shortened session bars and overnight boundaries', () => {
  const item = metadata({ timeframe: '5m' });
  const normalized = normalizeCandles([row()], item);
  assert.equal(normalized.candles[0].timestamp, '2026-03-09T13:30:00.000Z');
  assert.equal(normalized.candles[0].endTimestamp, '2026-03-09T13:33:00.000Z');
});
