import * as analyticsService from '../services/analyticsService.js';
import { narrate } from './narrate.js';

/**
 * Builds the deterministic findings for a single trading day: what went
 * well, what went wrong, the biggest mistake, best/worst trade, an
 * overtrading check, and a "tomorrow's focus" suggestion — all derived
 * directly from that day's actual trades, per spec section 20's Agent 2.
 */
export async function computeSessionReview(date, filters = {}) {
  const dateFrom = new Date(`${date}T00:00:00.000Z`);
  const dateTo = new Date(`${date}T23:59:59.999Z`);
  const trades = await analyticsService.getFilteredTrades({
    ...filters,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  });
  const closed = analyticsService.closedOnly(trades);

  if (closed.length === 0) {
    return {
      date,
      sampleSize: 0,
      findings: [`No closed trades were logged on ${date}.`],
      wentWell: [],
      wentWrong: [],
      biggestMistake: null,
      bestTrade: null,
      worstTrade: null,
      overtrading: null,
      tomorrowsFocus: 'No trades to review for this date.',
    };
  }

  const summary = analyticsService.computeSummary(trades);
  const mistakes = analyticsService.computeTagBreakdown(closed, 'mistake');
  const violations = analyticsService.computeRuleViolations(closed);
  const best = closed.reduce((a, b) => (b.netPnL > (a?.netPnL ?? -Infinity) ? b : a), null);
  const worst = closed.reduce((a, b) => (b.netPnL < (a?.netPnL ?? Infinity) ? b : a), null);
  const biggestMistake = mistakes.length ? mistakes.sort((a, b) => b.count - a.count)[0] : null;

  const wentWell = [];
  const wentWrong = [];

  if (summary.netPnL > 0) wentWell.push(`Net P&L was positive: $${summary.netPnL.toFixed(2)} across ${closed.length} trade(s).`);
  if (summary.winRate !== null && summary.winRate >= 60) wentWell.push(`Win rate was ${summary.winRate}% over ${closed.length} trade(s).`);
  if (violations.violations === 0 && violations.tradesWithPlanFlagSet > 0) wentWell.push(`You followed your plan on all ${violations.tradesWithPlanFlagSet} trade(s) where you tracked it.`);

  if (summary.netPnL < 0) wentWrong.push(`Net P&L was negative: -$${Math.abs(summary.netPnL).toFixed(2)} across ${closed.length} trade(s).`);
  if (violations.violations > 0) wentWrong.push(`You marked ${violations.violations} of ${violations.tradesWithPlanFlagSet} trade(s) as not following your plan.`);
  if (biggestMistake) wentWrong.push(`"${biggestMistake.tag}" was tagged on ${biggestMistake.count} trade(s) today, averaging $${biggestMistake.avgPnL.toFixed(2)} per trade.`);

  const overtradingThreshold = 5; // simple, stated default — not user-hidden
  const overtrading =
    closed.length >= overtradingThreshold
      ? `You placed ${closed.length} trades today, at or above the ${overtradingThreshold}-trade reference point some traders use to flag overtrading. This isn't a judgment — just a count.`
      : null;

  const findings = [
    ...wentWell,
    ...wentWrong,
    overtrading,
    best ? `Best trade: ${best.symbol} at $${best.netPnL.toFixed(2)}.` : null,
    worst ? `Worst trade: ${worst.symbol} at $${worst.netPnL.toFixed(2)}.` : null,
  ].filter(Boolean);

  const tomorrowsFocus = biggestMistake
    ? `Consider a specific plan for avoiding "${biggestMistake.tag}" tomorrow — it showed up ${biggestMistake.count} time(s) today.`
    : summary.netPnL < 0
    ? 'Review today\'s losing trades for a common thread before the next session.'
    : 'No specific red flag stood out today — keep doing what worked.';

  return {
    date,
    sampleSize: closed.length,
    summary,
    findings,
    wentWell,
    wentWrong,
    biggestMistake,
    bestTrade: best ? { symbol: best.symbol, netPnL: best.netPnL } : null,
    worstTrade: worst ? { symbol: worst.symbol, netPnL: worst.netPnL } : null,
    overtrading,
    tomorrowsFocus,
  };
}

export async function generateSessionReview(date, filters = {}) {
  const review = await computeSessionReview(date, filters);
  const narrative = await narrate(review.findings, { title: 'Session Review' });
  return { ...review, narrative };
}

export default { computeSessionReview, generateSessionReview };
