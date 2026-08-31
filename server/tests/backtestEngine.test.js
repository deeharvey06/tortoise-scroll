import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from '../src/engines/backtestEngine.js';

// Synthetic OHLC fixture, for testing the simulator's math only — the
// engine itself never generates or presents data like this to a user; real
// runs require bars from a connected market-data provider.
function makeBar(i, close, { high, low } = {}) {
  return {
    time: `2026-01-01T${String(i).padStart(2, '0')}:00:00Z`,
    open: close,
    high: high ?? close,
    low: low ?? close,
    close,
  };
}

test('long SMA crossover enters and exits on opposite crossover, computes correct P&L', () => {
  // Price ramps up (fast SMA crosses above slow), then ramps back down
  // (fast crosses below) — one full round-trip trade.
  const closes = [10, 10, 10, 10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 10, 10];
  const bars = closes.map((c, i) => makeBar(i, c));

  const result = runBacktest({
    bars,
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 2, slowPeriod: 4 },
    positionSize: 10,
    commission: 0,
    slippage: 0,
  });

  assert.ok(result.trades.length >= 1, 'expected at least one simulated trade');
  const t = result.trades[0];
  assert.equal(t.direction, 'long');
  // Entry should happen on the up-ramp, exit on the down-ramp — net P&L
  // should be positive since it captures the middle of the move.
  assert.ok(t.netPnL > 0, `expected a profitable trade, got ${t.netPnL}`);
});

test('stop loss triggers via bar low, produces correct capped loss', () => {
  // Enter, then price gaps down hard through the bar's low — stop should
  // fire at the stop price, not at the close.
  const closes = [10, 10, 10, 10, 11, 12, 13, 20, 5, 5, 5, 5, 5, 5, 5, 5];
  const bars = closes.map((c, i) => makeBar(i, c));
  // Make bar index 8 (close=5) have a very low "low" so the stop is hit intrabar
  bars[8].low = 5;
  bars[8].high = 13;

  const result = runBacktest({
    bars,
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 2, slowPeriod: 4 },
    stopLossPct: 5, // 5% below entry
    positionSize: 10,
    commission: 0,
    slippage: 0,
  });

  assert.ok(result.trades.length >= 1);
  const stopped = result.trades.find((t) => t.exitReason === 'stop');
  assert.ok(stopped, 'expected a stop-loss exit given the sharp drop');
  assert.ok(stopped.netPnL < 0, 'stop-loss exit should be a loss');
  // Loss should be roughly bounded near 5% of entry * quantity, not a much
  // larger loss reflecting the close price after the gap.
  const approxMaxLoss = stopped.entryPrice * 0.05 * 10 * 1.5; // generous margin
  assert.ok(Math.abs(stopped.netPnL) <= approxMaxLoss, `stop should cap the loss, got ${stopped.netPnL}`);
});

test('commission and slippage reduce net P&L relative to gross', () => {
  const closes = [10, 10, 10, 10, 11, 12, 13, 14, 13, 12, 11, 10, 10, 10];
  const bars = closes.map((c, i) => makeBar(i, c));

  const noCost = runBacktest({
    bars,
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 2, slowPeriod: 4 },
    positionSize: 10,
    commission: 0,
    slippage: 0,
  });
  const withCost = runBacktest({
    bars,
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 2, slowPeriod: 4 },
    positionSize: 10,
    commission: 5,
    slippage: 0.1,
  });

  assert.ok(noCost.trades.length >= 1 && withCost.trades.length >= 1);
  assert.ok(
    withCost.trades[0].netPnL < noCost.trades[0].netPnL,
    'commission/slippage should strictly reduce net P&L vs the zero-cost run'
  );
});

test('summary reports null stats (not zero/misleading) when no trades occurred', () => {
  const flatCloses = new Array(10).fill(10);
  const bars = flatCloses.map((c, i) => makeBar(i, c));

  const result = runBacktest({
    bars,
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 2, slowPeriod: 4 },
    positionSize: 10,
  });

  assert.equal(result.trades.length, 0);
  assert.equal(result.summary.totalTrades, 0);
  assert.equal(result.summary.netPnL, null);
  assert.equal(result.summary.winRate, null);
});

test('throws a clear error for unsupported entry rule types rather than silently no-opping', () => {
  const bars = [makeBar(0, 10), makeBar(1, 11)];
  assert.throws(
    () => runBacktest({ bars, entryRule: { type: 'unsupportedType' } }),
    /Only entryRule.type === "smaCrossover" is supported/
  );
});
