import test from 'node:test';
import assert from 'node:assert/strict';
import { runStrategyBacktest } from '../src/engines/backtestEngine.js';
import { createSignalEngine } from '../src/engines/backtest/signalEngine.js';
import { fillPrice } from '../src/engines/backtest/executionSimulator.js';
import { executeStrategy } from '../src/services/backtestService.js';
import {
  bars,
  strategy,
  execution,
  contract,
} from './fixtures/backtest/helpers.js';
const run = (rows, extra = {}) =>
  runStrategyBacktest({
    bars: bars(rows),
    strategy,
    execution,
    contract,
    ...extra,
  });

test('market signal fills next open, not signal close/open; manually calculated target and analytics', () => {
  const result = run([
    [90, 101, 89, 100],
    [100, 104, 99, 103],
  ]);

  assert.equal(result.trades.length, 1);
  assert.equal(result.trades[0].entryPrice, 100);
  assert.equal(result.trades[0].exitPrice, 104);
  assert.equal(result.trades[0].entryTime, '2026-03-09T13:31:00.000Z');
  assert.equal(result.summary.netPnL, 4);
  assert.equal(result.summary.totalR, 2);
  assert.equal(result.summary.winRate, 100);
  assert.equal(result.summary.expectancy, 4);
  assert.equal(result.breakdown.setup[0].key, 'RTH');
});

test('both-hit bars follow explicit path and initial losing trade counts in drawdown', () => {
  const rows = [
    [100, 101, 99, 100],
    [100, 105, 97, 101],
  ];

  const lowFirst = run(rows),
    highFirst = run(rows, {
      execution: { ...execution, intrabarPath: 'open-high-low-close' },
    });

  assert.equal(lowFirst.trades[0].exitReason, 'stop');
  assert.equal(lowFirst.summary.netPnL, -2);
  assert.equal(lowFirst.summary.maxDrawdown, -2);
  assert.equal(highFirst.trades[0].exitReason, 'target');
  assert.equal(highFirst.summary.netPnL, 4);
});

test('opening gap through a protective stop uses opening price plus adverse slippage', () => {
  const result = run(
    [
      [100, 101, 99, 100],
      [100, 101, 99, 100],
      [90, 92, 89, 91],
    ],
    {
      execution: {
        ...execution,
        slippageTicks: 1,
        commissionPerUnitPerSide: 0.5,
        quantity: 2,
      },
    }
  );

  const t = result.trades[0];
  assert.equal(t.entryPrice, 100.01);
  assert.equal(t.exitPrice, 89.99);
  assert.equal(t.grossPnL, -20.04);
  assert.equal(t.netPnL, -22.04);
  assert.equal(t.commissions, 2);
});

test('long and short stop entries gap to open; limits respect price protection and improve at open', () => {
  const stop = run(
    [
      [100, 101, 99, 100],
      [105, 106, 104, 105],
    ],
    {
      strategy: {
        ...strategy,
        entry: { type: 'stop', reference: 'high', offset: 0 },
      },
    }
  );

  assert.equal(stop.openPosition.entryPrice, 105);

  const limit = run(
    [
      [100, 101, 99, 100],
      [95, 96, 94, 95],
    ],
    {
      strategy: {
        ...strategy,
        entry: { type: 'limit', reference: 'low', offset: 0 },
      },
    }
  );

  assert.equal(limit.openPosition.entryPrice, 95);

  const short = run(
    [
      [100, 101, 99, 100],
      [95, 96, 94, 95],
    ],
    {
      strategy: {
        ...strategy,
        direction: 'short',
        entry: { type: 'stop', reference: 'low', offset: 0 },
      },
    }
  );

  assert.equal(short.openPosition.entryPrice, 95);
  assert.equal(
    fillPrice(
      100,
      'buy',
      'limit',
      { ...execution, slippageTicks: 100 },
      contract,
      100
    ),
    100
  );

  assert.equal(
    fillPrice(
      105,
      'sell',
      'limit',
      { ...execution, slippageTicks: 100 },
      contract,
      104
    ),
    104
  );
});

test('intrabar entry ignores earlier extremes and protects only after entry along selected path', () => {
  const result = run(
    [
      [100, 101, 99, 100],
      [100, 102, 95, 101],
    ],
    {
      strategy: {
        ...strategy,
        entry: { type: 'stop', reference: 'high', offset: 0 },
        stop: { type: 'signalExtreme' },
      },
    }
  );

  assert.equal(result.trades.length, 0);
  assert.equal(result.openPosition.entryPrice, 101);
  assert.equal(result.openPosition.stop, 99);
});

test('unfilled entries expire, signal is not consumed early, invalid risk after gap is rejected', () => {
  const result = run(
    [
      [100, 110, 99, 100],
      [100, 105, 99, 100],
    ],
    {
      strategy: {
        ...strategy,
        entry: { type: 'stop', reference: 'high', offset: 1 },
      },
    }
  );

  assert.equal(result.events.filter((e) => e.type === 'entry').length, 0);
  assert.ok(result.events.some((e) => e.type === 'expire'));
  assert.equal(result.pendingOrder.state, 'unfilled-at-end');

  const rejected = run(
    [
      [100, 101, 99, 100],
      [95, 96, 94, 95],
    ],
    { strategy: { ...strategy, stop: { type: 'signalExtreme' } } }
  );

  assert.equal(rejected.openPosition, null);
  assert.ok(rejected.events.some((e) => e.type === 'rejectedEntry'));
});

test('commission/multiplier/short transitions and tick rounding are deterministic', () => {
  const result = run(
    [
      [100, 101, 99, 100],
      [100, 100, 94, 95],
    ],
    {
      strategy: { ...strategy, direction: 'short' },
      contract: { ...contract, tickSize: 0.25, contractMultiplier: 50 },
      execution: {
        ...execution,
        quantity: 2,
        slippageTicks: 1,
        commissionPerUnitPerSide: 1.25,
      },
    }
  );

  assert.equal(result.trades[0].entryPrice, 99.75);
  assert.equal(result.trades[0].exitPrice, 95.75);
  assert.equal(result.summary.netPnL, 395);
  assert.equal(result.summary.totalR, 1.975);
});

test('session ends flatten only at declared current-bar close; carry and end-of-data remain explicit', () => {
  const rows = [
    [100, 101, 99, 100],
    [100, 101, 99, 101],
  ];
  const flat = run(rows, {
    sessionEnds: [bars(rows)[1].endTimestamp],
    execution: { ...execution, sessionBoundary: 'flatten' },
  });

  assert.equal(flat.trades[0].exitReason, 'session');
  assert.equal(flat.summary.netPnL, 1);
  assert.equal(run(rows).trades.length, 0);
  assert.equal(
    run(rows, { execution: { ...execution, endOfData: 'close' } }).trades[0]
      .exitReason,
    'endOfData'
  );

  const closed = bars(rows);
  closed[1] = {
    ...closed[1],
    timestamp: '2026-03-10T13:30:00.000Z',
    endTimestamp: '2026-03-10T13:31:00.000Z',
    tradingDate: '2026-03-10',
  };

  const cancelled = runStrategyBacktest({
    bars: closed,
    strategy,
    execution,
    contract,
  });

  assert.equal(cancelled.openPosition, null);
  assert.ok(cancelled.events.some((e) => e.type === 'cancel'));
});

test('EMA, previous inside-bar, session conjunction and SMA crossings consume only past/current bars', () => {
  const source = bars([
    [100, 110, 90, 100],
    [100, 105, 95, 101],
    [102, 106, 100, 104],
  ]);

  const engine = createSignalEngine({
    ...strategy,
    all: [
      { type: 'ema', period: 2, comparison: 'above' },
      { type: 'insideBar', offset: 1 },
      { type: 'session', value: 'rth' },
    ],
  });

  assert.deepEqual(
    source.map((b) => engine.consume(b).enter),
    [false, false, true]
  );

  const cross = createSignalEngine({
    ...strategy,
    all: [
      { type: 'smaCross', fastPeriod: 1, slowPeriod: 2, direction: 'above' },
    ],
    exitOnOppositeCross: true,
  });

  assert.deepEqual(
    bars([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [1, 1, 1, 1],
    ]).map((b) => cross.consume(b)),
    [
      { enter: false, exit: false },
      { enter: false, exit: false },
      { enter: true, exit: false },
      { enter: false, exit: true },
    ]
  );
});

test('future perturbations cannot alter past events/trades; repeated full results are byte-identical', () => {
  const source = [
    [100, 101, 99, 100],
    [100, 101, 99, 100],
    [100, 104, 99, 104],
  ];

  const first = run(source);
  assert.equal(JSON.stringify(first), JSON.stringify(run(source)));
  const extended = run([...source, [1000, 1100, 900, 1050]]);
  assert.deepEqual(extended.events.slice(0, first.events.length), first.events);
  assert.deepEqual(
    extended.trades.filter((t) => t.exitTime <= '2026-03-09T13:33:00.000Z'),
    first.trades
  );
});

test('strict definitions require policy acceptance and reject unsupported/future rule inputs', () => {
  for (const change of [
    { accepted: false },
    { intrabarPath: 'random' },
    { slippageTicks: -1 },
    { quantity: 0 },
  ])
    assert.throws(() =>
      run([[1, 1, 1, 1]], { execution: { ...execution, ...change } })
    );
  assert.throws(() =>
    run([[1, 1, 1, 1]], {
      strategy: { ...strategy, all: [{ type: 'futureClose' }] },
    })
  );

  assert.throws(() => run([[1, 0, 1, 1]]), /Malformed/);
  assert.throws(
    () => run([[1, 1, 1, 1]], { contract: {} }),
    /metadata|required/
  );
});

test('market-data boundary rejects missing, adjusted, partial bars and continuous futures, preserving trusted owner', async () => {
  const source = bars([
    [100, 101, 99, 100],
    [100, 101, 99, 100],
  ]);

  const config = {
    datasetId: 'fixture',
    symbol: 'AAPL',
    timeframe: '1m',
    dateFrom: source[0].timestamp,
    dateTo: source[1].endTimestamp,
    strategyDefinition: strategy,
    execution,
  };

  let result = {
    state: 'available',
    calendar: { sessions: [{ end: config.dateTo }] },
    candles: source,
    contractMetadata: contract,
    dataset: {
      id: 'fixture',
      revision: 'fixed',
      timezone: 'America/New_York',
      assetType: 'equity',
      priceBasis: 'unadjusted',
    },
    request: { symbol: 'AAPL', to: config.dateTo },
  };

  const provider = {
    getCandles: async (input) => {
      assert.equal(input.userId, 'trusted');
      return result;
    },
    listDatasets: async (owner) => {
      assert.equal(owner, 'trusted');
      return [
        { id: 'fixture', calendar: { sessions: [{ end: config.dateTo }] } },
      ];
    },
  };

  const good = await executeStrategy(config, 'trusted', provider);
  assert.equal(good.engineVersion, 2);
  const base = result;

  for (const patch of [
    { state: 'partial' },
    { dataset: { ...base.dataset, priceBasis: 'adjusted' } },
    { request: { ...base.request, to: source[1].timestamp } },
    { dataset: { ...base.dataset, assetType: 'future' } },
    { contractMetadata: null },
  ]) {
    result = { ...base, ...patch };
    await assert.rejects(() => executeStrategy(config, 'trusted', provider));
  }
});

test('DST and overnight session breaks use UTC instants and explicit carry/cancel policy', () => {
  const source = bars([
    [100, 101, 99, 100],
    [100, 101, 99, 100],
    [90, 91, 89, 90],
  ]);
  source[0] = {
    ...source[0],
    timestamp: '2026-03-06T14:30:00.000Z',
    endTimestamp: '2026-03-06T14:31:00.000Z',
    tradingDate: '2026-03-06',
  };
  source[1] = {
    ...source[1],
    timestamp: '2026-03-06T14:31:00.000Z',
    endTimestamp: '2026-03-06T14:32:00.000Z',
    tradingDate: '2026-03-06',
  };
  source[2] = {
    ...source[2],
    timestamp: '2026-03-09T13:30:00.000Z',
    endTimestamp: '2026-03-09T13:31:00.000Z',
    tradingDate: '2026-03-09',
  };
  const result = runStrategyBacktest({
    bars: source,
    strategy,
    execution,
    contract,
  });
  assert.equal(result.trades[0].exitTime, source[2].timestamp);
  assert.equal(result.trades[0].netPnL, -10);
  assert.equal(result.trades[0].exitReason, 'stop');
});
test('negative prices and percentage stops/targets preserve sign and positive risk', () => {
  const result = run(
    [
      [-100, -99, -101, -100],
      [-100, -97, -100, -98],
    ],
    {
      strategy: {
        ...strategy,
        stop: { type: 'percent', value: 1 },
        target: { type: 'percent', value: 2 },
      },
    }
  );
  assert.equal(result.trades[0].stop, -101);
  assert.equal(result.trades[0].exitPrice, -98);
  assert.equal(result.trades[0].rMultiple, 2);
});
test('dated futures use contract metadata and prohibit fractional contracts', async () => {
  const source = bars([
    [100, 101, 99, 100],
    [100, 104, 99, 104],
  ]).map((b) => ({ ...b, symbol: 'ESU26' }));
  const config = {
    symbol: 'ESU26',
    timeframe: '1m',
    datasetId: 'dated',
    dateFrom: source[0].timestamp,
    dateTo: source[1].endTimestamp,
    strategyDefinition: strategy,
    execution,
  };
  const provider = {
    getCandles: async () => ({
      state: 'available',
      calendar: { sessions: [{ end: config.dateTo }] },
      candles: source,
      dataset: {
        id: 'dated',
        assetType: 'future',
        priceBasis: 'unadjusted',
        timezone: 'America/Chicago',
      },
      request: { symbol: 'ESU26', to: config.dateTo },
      contractMetadata: { ...contract, tickSize: 0.25, contractMultiplier: 50 },
    }),
    listDatasets: async () => [
      { id: 'dated', calendar: { sessions: [{ end: config.dateTo }] } },
    ],
  };
  const result = await executeStrategy(config, 'owner', provider);
  assert.equal(result.summary.netPnL, 200);
  await assert.rejects(
    () =>
      executeStrategy(
        { ...config, execution: { ...execution, quantity: 0.5 } },
        'owner',
        provider
      ),
    /whole contracts/
  );
});

test('intrabar slipped entry receives immediate stop protection at the modeled price', () => {
  const result = run(
    [
      [100, 101, 99, 100],
      [100, 104, 99, 104],
    ],
    {
      strategy: {
        ...strategy,
        entry: { type: 'stop', reference: 'high', offset: 0 },
        stop: { type: 'distance', value: 1 },
      },
      execution: { ...execution, slippageTicks: 200 },
    }
  );
  assert.equal(result.trades[0].entryPrice, 103);
  assert.equal(result.trades[0].exitPrice, 99);
  assert.equal(result.trades[0].exitReason, 'stop');
  assert.equal(result.trades[0].netPnL, -4);
});

test('duplicate SMA conditions read the same previous state and cannot change signal semantics', () => {
  const rule = {
    type: 'smaCross',
    fastPeriod: 1,
    slowPeriod: 2,
    direction: 'above',
  };
  const engine = createSignalEngine({ ...strategy, all: [rule, { ...rule }] });
  assert.deepEqual(
    bars([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
    ]).map((bar) => engine.consume(bar).enter),
    [false, false, true]
  );
});
