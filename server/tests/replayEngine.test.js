import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectReplay,
  transition,
} from '../src/services/replay/replayEngine.js';
import {
  historicalMarkers,
  historicalComparison,
} from '../src/services/replay/historicalOverlay.js';
import { computeIndicators } from '../src/services/replay/indicators.js';

const bars = Array.from({ length: 5 }, (_, i) => ({
  symbol: 'AAPL',
  timeframe: '1m',
  timestamp: `2026-03-09T13:3${i}:00.000Z`,
  endTimestamp: `2026-03-09T13:3${i + 1}:00.000Z`,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 10,
  timezone: 'America/New_York',
  tradingDate: '2026-03-09',
  session: 'rth',
}));
const trade = {
  id: 'trade',
  direction: 'long',
  quantity: 15,
  entryTime: bars[0].timestamp,
  entryPrice: 9999,
  exitTime: bars[4].timestamp,
  exitPrice: 8000,
  netPnL: 99999,
  setup: 'FUTURE SETUP',
  strategy: 'FUTURE STRATEGY',
  notes: 'FUTURE RESULT',
  stopLoss: 8000,
  takeProfit: 9000,
  executions: [
    { side: 'buy', time: '2026-03-09T13:30:10Z', price: 100, quantity: 10 },
    { side: 'buy', time: '2026-03-09T13:31:10Z', price: 101, quantity: 5 },
    { side: 'sell', time: '2026-03-09T13:32:10Z', price: 102, quantity: 4 },
    { side: 'sell', time: '2026-03-09T13:34:00Z', price: 103, quantity: 11 },
  ],
};
function run(overrides = {}) {
  return {
    _id: 'run',
    name: 'Review',
    mode: 'review',
    cursor: 0,
    maxCursor: 0,
    version: 0,
    barCount: bars.length,
    revealed: false,
    marketRequest: {
      symbol: 'AAPL',
      from: bars[0].timestamp,
      to: bars[4].endTimestamp,
    },
    dataset: { timezone: 'America/New_York' },
    historicalTrades: [trade],
    events: [],
    screenshots: [],
    ...overrides,
  };
}

test('replay starts before any complete bar and advances its clock to bar close, not open', () => {
  const initial = projectReplay(run({ cursor: -1, maxCursor: -1 }), bars);
  assert.deepEqual(initial.candles, []);
  assert.equal(initial.timestamp, bars[0].timestamp);
  assert.deepEqual(initial.markers, []);
  const first = projectReplay(run(), bars);
  assert.equal(first.timestamp, bars[0].endTimestamp);
  assert.equal(first.candles.length, 1);
  assert.equal(first.indicators.sessionHigh, 102);
  assert.equal(first.indicators.sessionLow, 99);
});

test('future price/volume/execution/result/annotation perturbations cannot change an as-of projection', () => {
  const expected = projectReplay(run(), bars);
  const changed = bars.map((bar, index) =>
    index > 0
      ? { ...bar, high: 999999, low: -99999, close: 50000, volume: 90000 }
      : bar
  );
  const history = {
    ...trade,
    netPnL: -1000,
    setup: 'secret',
    notes: 'secret',
    executions: trade.executions.map((fill, index) =>
      index > 0 ? { ...fill, price: 123456 } : fill
    ),
  };
  assert.deepEqual(
    projectReplay(run({ historicalTrades: [history] }), changed),
    expected
  );
  assert.ok(!JSON.stringify(expected).includes('FUTURE'));
  assert.ok(!JSON.stringify(expected).includes('99999'));
});

test('long and short entries, scale-ins, scale-outs and exits use only visible fills', () => {
  for (const direction of ['long', 'short']) {
    const item =
      direction === 'long'
        ? trade
        : {
            ...trade,
            direction,
            executions: trade.executions.map((fill) => ({
              ...fill,
              side: fill.side === 'buy' ? 'sell' : 'buy',
            })),
          };
    assert.deepEqual(
      historicalMarkers([item], bars[0].endTimestamp, bars[0].timestamp).map(
        (marker) => marker.kind
      ),
      ['entry']
    );
    assert.deepEqual(
      historicalMarkers([item], bars[4].endTimestamp, bars[0].timestamp).map(
        (marker) => marker.kind
      ),
      ['entry', 'scale-in', 'scale-out', 'exit']
    );
  }
});

test('manual trades use recorded aggregate entry/exit only at their respective timestamps', () => {
  const item = { ...trade, executions: [], quantity: 1 };
  assert.deepEqual(
    historicalMarkers([item], bars[0].endTimestamp, bars[0].timestamp).map(
      (marker) => marker.kind
    ),
    ['entry']
  );
  assert.deepEqual(
    historicalMarkers([item], bars[4].endTimestamp, bars[0].timestamp).map(
      (marker) => marker.kind
    ),
    ['entry', 'exit']
  );
});

test('unmatched reductions are labeled executions without inventing a position', () => {
  const item = {
    ...trade,
    executions: [
      { side: 'sell', time: bars[0].timestamp, price: 100, quantity: 1 },
    ],
  };
  assert.equal(
    historicalMarkers([item], bars[0].endTimestamp, bars[0].timestamp)[0].kind,
    'execution'
  );
});

test('blind mode withholds all original executions and results until explicit end reveal', () => {
  const blind = run({ mode: 'blind', cursor: 4, maxCursor: 4 });
  const hidden = projectReplay(blind, bars);
  assert.deepEqual(hidden.markers, []);
  assert.equal(hidden.comparison, null);
  assert.throws(
    () => transition(run({ mode: 'blind' }), { action: 'reveal' }),
    /Finish/
  );
  const revealed = projectReplay(
    { ...blind, ...transition(blind, { action: 'reveal' }) },
    bars
  );
  assert.equal(revealed.markers.length, 4);
  assert.equal(revealed.comparison[0].netPnL, 99999);
});

test('rewinding filters candles, markers, indicators, artifacts and original results again', () => {
  const source = run({
    revealed: true,
    cursor: 4,
    maxCursor: 4,
    events: [
      { kind: 'note', cursor: 0, text: 'early' },
      { kind: 'decision', cursor: 3, text: 'late' },
    ],
    screenshots: [
      { id: 'early', cursor: 0 },
      { id: 'late', cursor: 3 },
    ],
  });
  const view = projectReplay(
    { ...source, ...transition(source, { action: 'seek', cursor: 0 }) },
    bars
  );
  assert.equal(view.candles.length, 1);
  assert.equal(view.indicators.series.length, 1);
  assert.equal(view.events.length, 1);
  assert.equal(view.screenshots.length, 1);
  assert.equal(view.markers.length, 1);
  assert.equal(view.comparison, null);
  assert.equal(view.afterExposure, true);
});

test('step boundaries, multi-step, end of data and blind seek restrictions', () => {
  assert.equal(transition(run(), { action: 'step', count: 1 }).cursor, 1);
  assert.equal(transition(run(), { action: 'step', count: 100 }).cursor, 4);
  assert.equal(
    transition(run({ cursor: 4 }), { action: 'step', count: 1 }).cursor,
    4
  );
  for (const cursor of [-2, 5])
    assert.throws(() => transition(run(), { action: 'seek', cursor }));
  assert.throws(() =>
    transition(run({ mode: 'blind' }), { action: 'seek', cursor: 2 })
  );
  assert.equal(
    transition(run({ mode: 'blind', maxCursor: 3 }), {
      action: 'seek',
      cursor: 2,
    }).cursor,
    2
  );
});

test('post-review comparison does not reveal outcomes of trades closing after the replay range', () => {
  assert.equal(
    historicalComparison(
      [{ ...trade, exitTime: '2026-03-10T00:00:00Z' }],
      bars[4].endTimestamp
    )[0].netPnL,
    null
  );
  assert.equal(
    historicalComparison(
      [{ ...trade, entryTime: '2026-03-10T00:00:00Z' }],
      bars[4].endTimestamp
    ).length,
    0
  );
});

test('EMA uses explicit first-close seed and deterministic recurrence', () => {
  const values = [10, 12, 14].map((close, i) => ({
    ...bars[i],
    high: close,
    low: close,
    close,
  }));
  assert.deepEqual(
    computeIndicators(values, 3).series.map((point) => point.ema),
    [10, 11, 12.5]
  );
  assert.deepEqual(
    computeIndicators(values, 1).series.map((point) => point.ema),
    [10, 12, 14]
  );
  assert.deepEqual(computeIndicators(values), computeIndicators(values));
  for (const period of [0, -1, 201, 1.5])
    assert.throws(() => computeIndicators(values, period));
});

test('VWAP uses typical price and volume, resets on trading-date boundaries, and handles zero/unknown volume', () => {
  const values = [
    { ...bars[0], high: 12, low: 6, close: 9, volume: 10 },
    { ...bars[1], high: 15, low: 9, close: 12, volume: 20 },
  ];
  assert.deepEqual(
    computeIndicators(values).series.map((point) => point.vwap),
    [9, 11]
  );
  assert.equal(
    computeIndicators([{ ...values[0], volume: 0 }]).series[0].vwap,
    null
  );
  assert.equal(
    computeIndicators([{ ...values[0], volume: null }, values[1]]).series[1]
      .vwap,
    null
  );
  const next = { ...values[1], tradingDate: '2026-03-10' };
  const reset = computeIndicators([{ ...values[0], volume: null }, next]);
  assert.equal(reset.series[1].vwap, 12);
  assert.equal(reset.sessionHigh, 15);
  assert.equal(reset.sessionLow, 9);
  assert.equal(reset.vwapUnavailable, false);
  assert.equal(computeIndicators([]).sessionHigh, null);
});

test('negative and fractional prices are preserved in deterministic indicators', () => {
  const values = [
    { ...bars[0], high: -0.1, low: -0.3, close: -0.2, volume: 0.5 },
  ];
  assert.equal(computeIndicators(values).series[0].vwap, -0.2);
  assert.equal(computeIndicators(values).series[0].ema, -0.2);
});

test('UTC replay ordering survives DST offset changes and overnight trading dates without manufacturing bars', () => {
  const source = [
    {
      ...bars[0],
      timestamp: '2026-03-06T14:30:00.000Z',
      endTimestamp: '2026-03-06T14:31:00.000Z',
      tradingDate: '2026-03-06',
    },
    {
      ...bars[1],
      timestamp: '2026-03-09T13:30:00.000Z',
      endTimestamp: '2026-03-09T13:31:00.000Z',
      tradingDate: '2026-03-09',
    },
    {
      ...bars[2],
      timestamp: '2026-03-09T22:00:00.000Z',
      endTimestamp: '2026-03-09T22:01:00.000Z',
      tradingDate: '2026-03-10',
      session: 'eth',
    },
  ];
  const base = run({ barCount: 3, historicalTrades: [] });
  const first = projectReplay(base, source);
  const second = projectReplay({ ...base, cursor: 1, maxCursor: 1 }, source);
  assert.equal(first.timestamp, source[0].endTimestamp);
  assert.equal(second.timestamp, source[1].endTimestamp);
  assert.equal(second.candles.length, 2);
  assert.equal(second.indicators.sessionHigh, source[1].high);
  const overnight = projectReplay({ ...base, cursor: 2, maxCursor: 2 }, source);
  assert.equal(overnight.indicators.sessionLow, source[2].low);
  assert.equal(overnight.candles[2].tradingDate, '2026-03-10');
});
