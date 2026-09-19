import Decimal from 'decimal.js';
import { createSignalEngine } from './backtest/signalEngine.js';
import {
  fillPrice,
  roundTick,
  triggerAtOpen,
  segmentTrigger,
  pathFor,
} from './backtest/executionSimulator.js';
import { openPosition, closePosition } from './backtest/positionEngine.js';
import { parseDefinition, BacktestError } from './backtest/definition.js';
import {
  computeSummary,
  buildEquityCurve,
  buildDrawdownCurve,
  buildBySetup,
  buildByStrategy,
} from '../services/analyticsService.js';

export function simulate({
  bars,
  strategy,
  execution,
  contract,
  sessionEnds = [],
  provenance = {},
}) {
  if (!Array.isArray(bars) || !bars.length || bars.length > 5000)
    throw new BacktestError('A complete range of 1–5,000 bars is required.');
  if (
    !(contract?.tickSize > 0) ||
    !(contract?.contractMultiplier > 0) ||
    !Number.isFinite(contract.tickSize) ||
    !Number.isFinite(contract.contractMultiplier)
  )
    throw new BacktestError(
      'Confirmed tick size and contract multiplier are required.'
    );
  const signals = createSignalEngine(strategy),
    ends = new Set(sessionEnds);
  let position = null,
    pending = null,
    exitPending = false;
  const trades = [],
    events = [];
  const side = strategy.direction === 'long' ? 'buy' : 'sell';
  const exitSide = side === 'buy' ? 'sell' : 'buy';
  const close = (
    price,
    bar,
    reason,
    atOpen,
    type = 'market',
    limit = price
  ) => {
    const fill = fillPrice(price, exitSide, type, execution, contract, limit);
    trades.push(
      closePosition(
        position,
        fill,
        bar,
        reason,
        strategy,
        execution,
        contract,
        atOpen,
        trades.length + 1
      )
    );
    events.push({
      type: 'exit',
      time: atOpen ? bar.timestamp : bar.endTimestamp,
      reason,
      price: fill,
    });
    position = null;
  };
  const brackets = () =>
    position
      ? [
          ...(position.stop === null
            ? []
            : [
                {
                  type: 'stop',
                  side: exitSide,
                  price: position.stop,
                  reason: 'stop',
                },
              ]),
          ...(position.target === null
            ? []
            : [
                {
                  type: 'limit',
                  side: exitSide,
                  price: position.target,
                  reason: 'target',
                },
              ]),
        ]
      : [];
  const enter = (order, price, bar, atOpen) => {
    const fill = fillPrice(
      price,
      side,
      order.type,
      execution,
      contract,
      order.price
    );
    position = openPosition(
      fill,
      bar,
      order.signal,
      strategy,
      execution,
      contract,
      atOpen
    );
    events.push({
      type: position ? 'entry' : 'rejectedEntry',
      time: atOpen ? bar.timestamp : bar.endTimestamp,
      price: fill,
      reason: position
        ? order.type
        : 'invalid stop/target after gap or rounding',
    });
  };
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (
      ![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) ||
      bar.low > Math.min(bar.open, bar.close) ||
      bar.high < Math.max(bar.open, bar.close) ||
      bar.high < bar.low ||
      !Number.isFinite(Date.parse(bar.timestamp)) ||
      !Number.isFinite(Date.parse(bar.endTimestamp)) ||
      bar.endTimestamp <= bar.timestamp ||
      (i && bar.timestamp < bars[i - 1].endTimestamp)
    )
      throw new BacktestError(
        'Malformed or out-of-order candle. Use normalized Phase 4 data.'
      );
    // Opening gaps use the actual opening price before any intrabar path.
    if (position) {
      const hit = brackets().find((order) => triggerAtOpen(order, bar.open));
      if (hit) close(bar.open, bar, hit.reason, true, hit.type, hit.price);
      else if (exitPending) close(bar.open, bar, 'signal', true);
    }
    exitPending = false;
    if (pending) {
      const crossedSession =
        pending.signal.tradingDate !== bar.tradingDate ||
        pending.signal.session !== bar.session ||
        pending.signal.endTimestamp !== bar.timestamp;
      if (crossedSession && execution.pendingAcrossSessions === 'cancel') {
        events.push({
          type: 'cancel',
          time: bar.timestamp,
          reason: 'session boundary',
        });
        pending = null;
      } else if (triggerAtOpen(pending, bar.open)) {
        enter(pending, bar.open, bar, true);
        pending = null;
      }
    }
    // Newly opened market/gap orders also have immediate protection.
    if (position) {
      const hit = brackets().find((order) => triggerAtOpen(order, bar.open));
      if (hit) close(bar.open, bar, hit.reason, true, hit.type, hit.price);
    }
    const path = pathFor(bar, execution);
    for (let j = 1; j < path.length; j++) {
      let start = path[j - 1];
      const end = path[j];
      if (pending && segmentTrigger(pending, start, end)) {
        start = pending.price;
        enter(pending, start, bar, false);
        pending = null;
        // Slippage can put a newly derived stop beyond the current modeled
        // price. Protect immediately rather than waiting for another crossing.
        const immediate = brackets().find((order) =>
          triggerAtOpen(order, start)
        );
        if (immediate)
          close(
            start,
            bar,
            immediate.reason,
            false,
            immediate.type,
            immediate.price
          );
      }
      if (position) {
        const hit = brackets()
          .filter((order) => segmentTrigger(order, start, end))
          .sort(
            (a, b) => Math.abs(a.price - start) - Math.abs(b.price - start)
          )[0];
        if (hit) close(hit.price, bar, hit.reason, false, hit.type);
      }
    }
    if (pending) {
      events.push({
        type: 'expire',
        time: bar.endTimestamp,
        reason: 'next-bar order not touched',
      });
      pending = null;
    }
    if (
      position &&
      execution.sessionBoundary === 'flatten' &&
      ends.has(bar.endTimestamp)
    )
      close(bar.close, bar, 'session', false);
    // Bar N's close creates orders eligible only on N+1. No array or future
    // references are passed to the signal evaluator.
    const signal = signals.consume(bar);
    if (position && signal.exit) exitPending = true;
    if (!position && signal.enter) {
      const raw = new Decimal(bar[strategy.entry.reference]).plus(
        strategy.entry.offset
      );
      pending = {
        type: strategy.entry.type,
        side,
        price: roundTick(
          raw,
          contract.tickSize,
          strategy.entry.type === 'stop' ? side === 'buy' : side === 'sell'
        ),
        signal: bar,
      };
      events.push({
        type: 'signal',
        time: bar.endTimestamp,
        orderType: pending.type,
        price: pending.type === 'market' ? null : pending.price,
      });
    }
  }
  if (position && execution.endOfData === 'close')
    close(bars.at(-1).close, bars.at(-1), 'endOfData', false);
  const equity = buildEquityCurve(trades);
  // Seed at zero so the first losing trade contributes to drawdown.
  const drawdown = buildDrawdownCurve([
    { date: bars[0].timestamp, equity: 0 },
    ...equity,
  ]);
  const summary = {
    ...computeSummary(trades),
    totalR: trades.length
      ? trades
          .reduce((sum, t) => sum.plus(t.rMultiple ?? 0), new Decimal(0))
          .toDecimalPlaces(3)
          .toNumber()
      : null,
    maxDrawdown: trades.length ? drawdown.maxDrawdown : null,
  };
  const result = {
    engineVersion: 2,
    strategy,
    assumptions: execution,
    contract,
    provenance,
    trades,
    events,
    openPosition: position
      ? {
          ...position,
          quantity: execution.quantity,
          entryCommission: new Decimal(execution.commissionPerUnitPerSide)
            .times(execution.quantity)
            .toNumber(),
          unrealizedPnL: new Decimal(bars.at(-1).close)
            .minus(position.entryPrice)
            .times(side === 'buy' ? 1 : -1)
            .times(execution.quantity)
            .times(contract.contractMultiplier)
            .minus(
              new Decimal(execution.commissionPerUnitPerSide).times(
                execution.quantity
              )
            )
            .toDecimalPlaces(2)
            .toNumber(),
        }
      : null,
    pendingOrder: pending
      ? {
          type: pending.type,
          price: pending.type === 'market' ? null : pending.price,
          signalTime: pending.signal.endTimestamp,
          state: 'unfilled-at-end',
        }
      : null,
    equityCurve: [
      { time: bars[0].timestamp, equity: 0 },
      ...equity.map((p) => ({ time: p.date, equity: p.equity })),
    ],
    drawdownCurve: drawdown.curve,
    summary,
    breakdown: {
      strategy: buildByStrategy(trades),
      setup: buildBySetup(trades),
    },
  };
  const validateNumbers = (value) => {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new BacktestError('Simulation exceeds supported numeric range.');
    if (value && typeof value === 'object')
      for (const item of Object.values(value)) validateNumbers(item);
  };
  validateNumbers(result);
  return result;
}
export function runStrategyBacktest(input) {
  const parsed = parseDefinition(input.strategy, input.execution);
  return simulate({ ...input, ...parsed });
}
// Compatibility adapter: preserves old saved fields/results while correcting
// causal fills and opening gaps. Legacy assumptions are disclosed in every run.
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
  if (entryRule?.type !== 'smaCrossover')
    throw new BacktestError(
      'Only entryRule.type === "smaCrossover" is supported by legacy configurations'
    );
  if (
    !Number.isInteger(entryRule.fastPeriod) ||
    !Number.isInteger(entryRule.slowPeriod) ||
    entryRule.fastPeriod < 1 ||
    entryRule.fastPeriod >= entryRule.slowPeriod ||
    entryRule.slowPeriod > 500 ||
    !['long', 'short'].includes(direction) ||
    ![positionSize, commission, slippage].every(Number.isFinite) ||
    [stopLossPct, takeProfitPct].some(
      (value) => value !== null && (!Number.isFinite(value) || value <= 0)
    ) ||
    !(positionSize > 0) ||
    commission < 0 ||
    slippage < 0
  )
    throw new BacktestError('Invalid legacy periods, size or costs.');
  const tickSize = 0.00000001;
  const strategy = {
    version: 1,
    name: 'Legacy SMA',
    setup: 'SMA crossover',
    direction,
    all: [
      {
        type: 'smaCross',
        fastPeriod: entryRule.fastPeriod,
        slowPeriod: entryRule.slowPeriod,
        direction: direction === 'long' ? 'above' : 'below',
      },
    ],
    entry: { type: 'market', reference: 'close', offset: 0 },
    stop: stopLossPct === null ? null : { type: 'percent', value: stopLossPct },
    target:
      takeProfitPct === null ? null : { type: 'percent', value: takeProfitPct },
    exitOnOppositeCross: true,
  };
  const execution = {
    version: 1,
    accepted: false,
    intrabarPath: 'open-low-high-close',
    sessionBoundary: 'carry',
    endOfData: 'leaveOpen',
    pendingAcrossSessions: 'allow',
    quantity: positionSize,
    slippageTicks: new Decimal(slippage).div(tickSize).toNumber(),
    commissionPerUnitPerSide: new Decimal(commission)
      .div(positionSize)
      .toNumber(),
    fillPolicy: 'full-touch-no-volume-limit',
    timeInForce: 'nextBar',
    missingBars: 'reject',
    futuresRollover: 'single-contract-no-roll',
  };
  const normalized = bars?.map((b) => ({
    ...b,
    timestamp: new Date(b.timestamp || b.time).toISOString(),
    endTimestamp:
      b.endTimestamp || new Date(Date.parse(b.time) + 1).toISOString(),
    symbol: b.symbol || 'LEGACY',
    session: b.session || 'unknown',
    tradingDate: b.tradingDate || String(b.time).slice(0, 10),
  }));
  return simulate({
    bars: normalized,
    strategy,
    execution,
    contract: { tickSize, contractMultiplier: 1 },
    provenance: {
      compatibility:
        'Legacy configuration: next-bar fills, adverse opening gaps, low-first OHLC path, full fills, carry sessions, open positions excluded from realized statistics. Legacy slippage is price units; commission is per order side. Save as a versioned strategy to select assumptions and use contract tick metadata.',
    },
  });
}
export default { runBacktest, runStrategyBacktest };
