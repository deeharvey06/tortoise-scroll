import Decimal from 'decimal.js';
import Trade from '../models/Trade.js';
import { buildTradeQuery } from './tradeService.js';

const D = (v) => new Decimal(v ?? 0);

const PROJECTION =
  '_id symbol direction quantity entryPrice exitPrice entryTime exitTime netPnL grossPnL rMultiple ' +
  'holdingTimeSeconds setup strategy session tags mistake emotion followedPlan accountId';

/**
 * Fetches the trades matching a filter set. Kept as its own function so
 * every analytics/report endpoint filters identically to the Trades list —
 * "what you filtered on the Trades page" and "what the dashboard shows"
 * never silently diverge.
 *
 * Note on scale: this loads matched trades into memory and reduces them in
 * JS (via decimal.js) rather than a Mongo aggregation pipeline, so P&L math
 * stays exactly as precise as the per-trade calculationsService. This is
 * fine at personal-journal scale (thousands–tens of thousands of trades);
 * Phase 8 (Performance) is where this gets replaced with aggregation
 * pipelines + indexes for 100k+ trade datasets, per the project plan.
 */
export async function getFilteredTrades(filters = {}) {
  const query = buildTradeQuery(filters);
  return Trade.find(query).select(PROJECTION).lean();
}

export function closedOnly(trades) {
  return trades.filter((t) => t.netPnL !== null && t.netPnL !== undefined && t.exitTime);
}

/**
 * The dashboard KPI card set. Every figure here is computed from actual
 * trade documents — nothing is hardcoded, and metrics that don't apply to
 * an empty/all-open dataset return null rather than a misleading 0.
 */
export function computeSummary(trades) {
  const closed = closedOnly(trades);
  const wins = closed.filter((t) => t.netPnL > 0);
  const losses = closed.filter((t) => t.netPnL < 0);

  const netPnL = closed.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
  const grossPnL = closed.reduce((sum, t) => sum.plus(D(t.grossPnL)), D(0));
  const sumWins = wins.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
  const sumLosses = losses.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0)); // negative

  const rValues = closed.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined).map((t) => t.rMultiple);
  const totalR = rValues.reduce((sum, r) => sum.plus(D(r)), D(0));

  const holdingTimes = closed
    .filter((t) => t.holdingTimeSeconds !== null && t.holdingTimeSeconds !== undefined)
    .map((t) => t.holdingTimeSeconds);

  const winRate = closed.length > 0 ? D(wins.length).div(closed.length).times(100).toDecimalPlaces(2).toNumber() : null;
  const lossRate = closed.length > 0 ? D(losses.length).div(closed.length).times(100).toDecimalPlaces(2).toNumber() : null;

  const profitFactor =
    losses.length > 0 && !sumLosses.isZero()
      ? sumWins.div(sumLosses.abs()).toDecimalPlaces(2).toNumber()
      : wins.length > 0
      ? null // undefined/infinite — no losing trades to divide by; report as null, not a fake number
      : null;

  return {
    netPnL: closed.length ? netPnL.toDecimalPlaces(2).toNumber() : null,
    grossPnL: closed.length ? grossPnL.toDecimalPlaces(2).toNumber() : null,
    winRate,
    lossRate,
    profitFactor,
    avgWin: wins.length ? sumWins.div(wins.length).toDecimalPlaces(2).toNumber() : null,
    avgLoss: losses.length ? sumLosses.div(losses.length).toDecimalPlaces(2).toNumber() : null,
    expectancy: closed.length ? netPnL.div(closed.length).toDecimalPlaces(2).toNumber() : null,
    avgR: rValues.length ? totalR.div(rValues.length).toDecimalPlaces(3).toNumber() : null,
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    largestWinner: wins.length ? Math.max(...wins.map((t) => t.netPnL)) : null,
    largestLoser: losses.length ? Math.min(...losses.map((t) => t.netPnL)) : null,
    avgHoldingTimeSeconds: holdingTimes.length
      ? Math.round(holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length)
      : null,
    // maxDrawdown is attached by the caller once the equity curve is built,
    // since it's derived from the same closed-trade sequence.
  };
}

/** Sorted cumulative net P&L over time, optionally offset by a starting balance. */
export function buildEquityCurve(closedTrades, startingBalance = 0) {
  const sorted = [...closedTrades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
  let running = D(startingBalance);
  return sorted.map((t) => {
    running = running.plus(D(t.netPnL));
    return { date: t.exitTime, equity: running.toDecimalPlaces(2).toNumber(), tradeId: t._id, symbol: t.symbol };
  });
}

/** Running peak-to-trough drawdown derived from an equity curve. */
export function buildDrawdownCurve(equityCurve) {
  let peak = equityCurve.length ? equityCurve[0].equity : 0;
  let maxDrawdown = 0;
  const curve = equityCurve.map((point) => {
    peak = Math.max(peak, point.equity);
    const drawdown = D(point.equity).minus(D(peak)).toDecimalPlaces(2).toNumber(); // <= 0
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    return { date: point.date, drawdown, equity: point.equity, peak };
  });
  return { curve, maxDrawdown };
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Per-day P&L, trade count, and win rate — powers both the dashboard chart and the calendar. */
export function buildDailyStats(closedTrades) {
  const byDay = new Map();
  for (const t of closedTrades) {
    const key = dayKey(t.exitTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(t);
  }
  const days = [];
  for (const [date, dayTrades] of byDay.entries()) {
    const netPnL = dayTrades.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0)).toDecimalPlaces(2).toNumber();
    const wins = dayTrades.filter((t) => t.netPnL > 0).length;
    const rVals = dayTrades.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined).map((t) => t.rMultiple);
    const avgR = rVals.length ? rVals.reduce((a, b) => a + b, 0) / rVals.length : null;
    const best = dayTrades.reduce((a, b) => (b.netPnL > (a?.netPnL ?? -Infinity) ? b : a), null);
    const worst = dayTrades.reduce((a, b) => (b.netPnL < (a?.netPnL ?? Infinity) ? b : a), null);
    days.push({
      date,
      netPnL,
      tradeCount: dayTrades.length,
      winRate: D(wins).div(dayTrades.length).times(100).toDecimalPlaces(0).toNumber(),
      avgR,
      bestTrade: best ? { symbol: best.symbol, netPnL: best.netPnL } : null,
      worstTrade: worst ? { symbol: worst.symbol, netPnL: worst.netPnL } : null,
    });
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Generic fixed-bucket histogram over any numeric accessor. */
function bucketize(values, edges) {
  const labels = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    labels.push(`${edges[i] === -Infinity ? '<' : edges[i]}${i === 0 ? '' : ' to ' + edges[i + 1]}`);
  }
  const buckets = edges.slice(0, -1).map((lo, i) => ({ min: lo, max: edges[i + 1], count: 0 }));
  for (const v of values) {
    const b = buckets.find((bk) => v >= bk.min && v < bk.max) || buckets[buckets.length - 1];
    b.count += 1;
  }
  return buckets.map((b) => ({
    label: b.min === -Infinity ? `< ${b.max}` : b.max === Infinity ? `≥ ${b.min}` : `${b.min} to ${b.max}`,
    count: b.count,
  }));
}

export function buildWinLossDistribution(closedTrades) {
  const values = closedTrades.map((t) => t.netPnL);
  return bucketize(values, [-Infinity, -500, -200, -50, 0, 50, 200, 500, Infinity]);
}

export function buildRMultipleDistribution(closedTrades) {
  const values = closedTrades.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined).map((t) => t.rMultiple);
  return bucketize(values, [-Infinity, -2, -1, 0, 1, 2, 3, Infinity]);
}

/**
 * Generic grouping used for by-symbol / by-strategy / by-setup / by-session
 * / by-direction / by-day-of-week / by-hour. Every group reports its own
 * sample size (`count`) alongside the stats, per the project's "never
 * imply confidence a small sample doesn't support" rule.
 */
export function groupTrades(closedTrades, keyFn, labelFn = (k) => k) {
  const groups = new Map();
  for (const t of closedTrades) {
    const key = keyFn(t);
    if (key === null || key === undefined || key === '') continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const result = [];
  for (const [key, group] of groups.entries()) {
    const netPnL = group.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0)).toDecimalPlaces(2).toNumber();
    const wins = group.filter((t) => t.netPnL > 0);
    const losses = group.filter((t) => t.netPnL < 0);
    const sumWins = wins.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
    const sumLosses = losses.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0));
    const rVals = group.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined).map((t) => t.rMultiple);
    result.push({
      key,
      label: labelFn(key),
      count: group.length,
      netPnL,
      winRate: group.length ? D(wins.length).div(group.length).times(100).toDecimalPlaces(0).toNumber() : null,
      avgR: rVals.length ? D(rVals.reduce((a, b) => a + b, 0)).div(rVals.length).toDecimalPlaces(2).toNumber() : null,
      profitFactor: losses.length && !sumLosses.isZero() ? sumWins.div(sumLosses.abs()).toDecimalPlaces(2).toNumber() : null,
    });
  }
  return result.sort((a, b) => b.netPnL - a.netPnL);
}

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildByDayOfWeek(closedTrades) {
  return groupTrades(
    closedTrades,
    (t) => new Date(t.exitTime).getUTCDay(),
    (k) => DOW_LABELS[k]
  ).sort((a, b) => a.key - b.key);
}

export function buildByHour(closedTrades) {
  return groupTrades(
    closedTrades,
    (t) => new Date(t.entryTime).getUTCHours(),
    (k) => `${String(k).padStart(2, '0')}:00 UTC`
  ).sort((a, b) => a.key - b.key);
}

export function buildBySymbol(closedTrades) {
  return groupTrades(closedTrades, (t) => t.symbol, (k) => k).slice(0, 25);
}

export function buildByStrategy(closedTrades) {
  return groupTrades(closedTrades, (t) => t.strategy, (k) => String(k));
}

export function buildBySetup(closedTrades) {
  return groupTrades(closedTrades, (t) => t.setup, (k) => k);
}

export function buildBySession(closedTrades) {
  return groupTrades(closedTrades, (t) => t.session, (k) => k);
}

export function buildByDirection(closedTrades) {
  return groupTrades(closedTrades, (t) => t.direction, (k) => k);
}

/**
 * Full dashboard payload in one call — one round trip for the page that
 * needs the most data at once.
 */
export async function getDashboardAnalytics(filters, startingBalance = 0) {
  const trades = await getFilteredTrades(filters);
  const closed = closedOnly(trades);

  const summary = computeSummary(trades);
  const equityCurve = buildEquityCurve(closed, startingBalance);
  const { curve: drawdownCurve, maxDrawdown } = buildDrawdownCurve(equityCurve);
  summary.maxDrawdown = closed.length ? maxDrawdown : null;

  return {
    summary,
    equityCurve,
    drawdownCurve,
    dailyStats: buildDailyStats(closed),
    winLossDistribution: buildWinLossDistribution(closed),
    rMultipleDistribution: buildRMultipleDistribution(closed),
    byDayOfWeek: buildByDayOfWeek(closed),
    byHour: buildByHour(closed),
    bySymbol: buildBySymbol(closed),
    byStrategy: buildByStrategy(closed),
    bySetup: buildBySetup(closed),
    bySession: buildBySession(closed),
    byDirection: buildByDirection(closed),
  };
}

/** Calendar month view: one entry per day that had at least one closed trade. */
export async function getCalendarMonth(filters, year, month) {
  // month is 1-indexed from the client for readability
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const trades = await getFilteredTrades({ ...filters, dateFrom: from.toISOString(), dateTo: to.toISOString() });
  const closed = closedOnly(trades);
  return buildDailyStats(closed);
}

/** Longest and current consecutive-loss streaks, plus what happens after them (with sample sizes). */
export function computeStreaks(closedTrades) {
  const sorted = [...closedTrades].sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime));

  let longestLossStreak = 0;
  let currentStreak = 0;
  let currentStreakType = null; // 'win' | 'loss'
  const afterTwoLosses = []; // R multiples of trades that came right after >= 2 consecutive losses
  let consecutiveLosses = 0;

  for (const t of sorted) {
    const isWin = t.netPnL > 0;
    const isLoss = t.netPnL < 0;

    if (consecutiveLosses >= 2 && t.rMultiple !== null && t.rMultiple !== undefined) {
      afterTwoLosses.push(t.rMultiple);
    }

    if (isLoss) {
      consecutiveLosses += 1;
      longestLossStreak = Math.max(longestLossStreak, consecutiveLosses);
    } else if (isWin) {
      consecutiveLosses = 0;
    }

    if (isWin || isLoss) {
      const type = isWin ? 'win' : 'loss';
      currentStreak = type === currentStreakType ? currentStreak + 1 : 1;
      currentStreakType = type;
    }
  }

  return {
    longestLossStreak,
    currentStreak,
    currentStreakType,
    avgRAfterTwoConsecutiveLosses: afterTwoLosses.length
      ? D(afterTwoLosses.reduce((a, b) => a + b, 0)).div(afterTwoLosses.length).toDecimalPlaces(2).toNumber()
      : null,
    sampleSizeAfterTwoConsecutiveLosses: afterTwoLosses.length,
  };
}

/** Frequency + associated average P&L for each mistake/emotion tag actually present in the data. */
export function computeTagBreakdown(closedTrades, field) {
  const tagMap = new Map();
  for (const t of closedTrades) {
    for (const tag of t[field] || []) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push(t);
    }
  }
  const result = [];
  for (const [tag, group] of tagMap.entries()) {
    const netPnL = group.reduce((sum, t) => sum.plus(D(t.netPnL)), D(0)).toDecimalPlaces(2).toNumber();
    result.push({
      tag,
      count: group.length,
      avgPnL: D(netPnL).div(group.length).toDecimalPlaces(2).toNumber(),
      netPnL,
    });
  }
  return result.sort((a, b) => b.count - a.count);
}

/** Trades that broke the user's own stated plan/rules — a straight count, no editorializing. */
export function computeRuleViolations(closedTrades) {
  const withPlanFlag = closedTrades.filter((t) => t.followedPlan !== null && t.followedPlan !== undefined);
  const violations = withPlanFlag.filter((t) => t.followedPlan === false);
  return {
    tradesWithPlanFlagSet: withPlanFlag.length,
    violations: violations.length,
    violationRate: withPlanFlag.length ? D(violations.length).div(withPlanFlag.length).times(100).toDecimalPlaces(0).toNumber() : null,
  };
}

/** Trades-per-day, useful for spotting overtrading days without asserting a threshold ourselves. */
export function computeTradesPerDay(closedTrades) {
  const byDay = buildDailyStats(closedTrades);
  return byDay.map((d) => ({ date: d.date, tradeCount: d.tradeCount, netPnL: d.netPnL }));
}

export default {
  getFilteredTrades,
  closedOnly,
  computeSummary,
  buildEquityCurve,
  buildDrawdownCurve,
  buildDailyStats,
  buildWinLossDistribution,
  buildRMultipleDistribution,
  buildByDayOfWeek,
  buildByHour,
  buildBySymbol,
  buildByStrategy,
  buildBySetup,
  buildBySession,
  buildByDirection,
  getDashboardAnalytics,
  getCalendarMonth,
  computeStreaks,
  computeTagBreakdown,
  computeRuleViolations,
  computeTradesPerDay,
};
