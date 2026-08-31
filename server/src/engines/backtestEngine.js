import Decimal from 'decimal.js';

const D = (v) => new Decimal(v ?? 0);

/**
 * Pure backtesting engine. Takes real OHLC bars (supplied by the caller —
 * this module never fetches or fabricates data) plus a rule definition,
 * and simulates trades bar-by-bar. Kept entirely free of Express/Mongoose
 * so it can be unit-tested in isolation and reused by any future UI.
 *
 * Supported strategy (Phase 5 scope — the rule set is intentionally small
 * and will grow in later phases):
 *   entryRule: { type: 'smaCrossover', fastPeriod, slowPeriod }
 *     - direction 'long': enter when fast SMA crosses above slow SMA
 *     - direction 'short': enter when fast SMA crosses below slow SMA
 *   exit: whichever of these triggers first —
 *     - opposite SMA crossover
 *     - stopLossPct / takeProfitPct distance from entry (if provided)
 */

function simpleMovingAverage(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function crossesAbove(prevFast, prevSlow, fast, slow) {
  return prevFast !== null && prevSlow !== null && prevFast <= prevSlow && fast > slow;
}

function crossesBelow(prevFast, prevSlow, fast, slow) {
  return prevFast !== null && prevSlow !== null && prevFast >= prevSlow && fast < slow;
}

export function runBacktest({
  bars,
  direction = 'long',
  entryRule,
  stopLossPct = null,
  takeProfitPct = null,
  positionSize = 1,
  commission = 0,
  slippage = 0,
}) {
  if (!Array.isArray(bars) || bars.length === 0) {
    throw new Error('runBacktest requires a non-empty bars array');
  }
  if (!entryRule || entryRule.type !== 'smaCrossover') {
    throw new Error('Only entryRule.type === "smaCrossover" is supported in this phase');
  }

  const closes = bars.map((b) => b.close);
  const fastSMA = simpleMovingAverage(closes, entryRule.fastPeriod);
  const slowSMA = simpleMovingAverage(closes, entryRule.slowPeriod);

  const trades = [];
  let position = null; // { entryIndex, entryPrice, stop, target }
  let equity = D(0);
  const equityCurve = [];

  const slip = D(slippage);
  const posSize = D(positionSize);

  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];

    if (!position) {
      const entered =
        direction === 'long'
          ? crossesAbove(fastSMA[i - 1], slowSMA[i - 1], fastSMA[i], slowSMA[i])
          : crossesBelow(fastSMA[i - 1], slowSMA[i - 1], fastSMA[i], slowSMA[i]);

      if (entered) {
        const fillPrice = direction === 'long' ? D(bar.open).plus(slip) : D(bar.open).minus(slip);
        const stop =
          stopLossPct !== null
            ? direction === 'long'
              ? fillPrice.times(D(1).minus(D(stopLossPct).div(100)))
              : fillPrice.times(D(1).plus(D(stopLossPct).div(100)))
            : null;
        const target =
          takeProfitPct !== null
            ? direction === 'long'
              ? fillPrice.times(D(1).plus(D(takeProfitPct).div(100)))
              : fillPrice.times(D(1).minus(D(takeProfitPct).div(100)))
            : null;
        position = { entryIndex: i, entryTime: bar.time, entryPrice: fillPrice, stop, target };
      }
    } else {
      let exitPrice = null;
      let exitReason = null;

      // Intrabar stop/target check using the bar's high/low — real OHLC
      // data, not fabricated; this is standard backtest bar-resolution.
      if (position.stop !== null) {
        const stopNum = position.stop.toNumber();
        if ((direction === 'long' && bar.low <= stopNum) || (direction === 'short' && bar.high >= stopNum)) {
          exitPrice = position.stop;
          exitReason = 'stop';
        }
      }
      if (exitPrice === null && position.target !== null) {
        const targetNum = position.target.toNumber();
        if ((direction === 'long' && bar.high >= targetNum) || (direction === 'short' && bar.low <= targetNum)) {
          exitPrice = position.target;
          exitReason = 'target';
        }
      }
      if (exitPrice === null) {
        const oppositeCross =
          direction === 'long'
            ? crossesBelow(fastSMA[i - 1], slowSMA[i - 1], fastSMA[i], slowSMA[i])
            : crossesAbove(fastSMA[i - 1], slowSMA[i - 1], fastSMA[i], slowSMA[i]);
        if (oppositeCross) {
          exitPrice = direction === 'long' ? D(bar.open).minus(slip) : D(bar.open).plus(slip);
          exitReason = 'signal';
        }
      }

      if (exitPrice !== null) {
        const diff = direction === 'long' ? exitPrice.minus(position.entryPrice) : position.entryPrice.minus(exitPrice);
        const grossPnL = diff.times(posSize);
        const netPnL = grossPnL.minus(D(commission).times(2)); // entry + exit commission
        const riskPerUnit = position.stop !== null ? position.entryPrice.minus(position.stop).abs() : null;
        const rMultiple = riskPerUnit && riskPerUnit.gt(0) ? netPnL.div(riskPerUnit.times(posSize)) : null;

        trades.push({
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: position.entryPrice.toDecimalPlaces(4).toNumber(),
          exitPrice: exitPrice.toDecimalPlaces(4).toNumber(),
          direction,
          quantity: positionSize,
          grossPnL: grossPnL.toDecimalPlaces(2).toNumber(),
          netPnL: netPnL.toDecimalPlaces(2).toNumber(),
          rMultiple: rMultiple ? rMultiple.toDecimalPlaces(3).toNumber() : null,
          exitReason,
        });

        equity = equity.plus(netPnL);
        equityCurve.push({ time: bar.time, equity: equity.toDecimalPlaces(2).toNumber() });
        position = null;
      }
    }
  }

  return { trades, equityCurve, summary: summarize(trades) };
}

function summarize(trades) {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      netPnL: null,
      winRate: null,
      profitFactor: null,
      expectancy: null,
      avgR: null,
      maxDrawdown: null,
    };
  }
  const wins = trades.filter((t) => t.netPnL > 0);
  const losses = trades.filter((t) => t.netPnL < 0);
  const netPnL = trades.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
  const sumWins = wins.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
  const sumLosses = losses.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
  const rVals = trades.filter((t) => t.rMultiple !== null).map((t) => t.rMultiple);

  let peak = 0;
  let running = 0;
  let maxDrawdown = 0;
  for (const t of trades) {
    running += t.netPnL;
    peak = Math.max(peak, running);
    maxDrawdown = Math.min(maxDrawdown, running - peak);
  }

  return {
    totalTrades: trades.length,
    netPnL: netPnL.toDecimalPlaces(2).toNumber(),
    winRate: D(wins.length).div(trades.length).times(100).toDecimalPlaces(1).toNumber(),
    profitFactor: losses.length && !sumLosses.isZero() ? sumWins.div(sumLosses.abs()).toDecimalPlaces(2).toNumber() : null,
    expectancy: netPnL.div(trades.length).toDecimalPlaces(2).toNumber(),
    avgR: rVals.length ? D(rVals.reduce((a, b) => a + b, 0)).div(rVals.length).toDecimalPlaces(2).toNumber() : null,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  };
}

export default { runBacktest };
