import * as analyticsService from './analyticsService.js';

/**
 * Performance stats for a single strategy or playbook (spec sections 11 &
 * 12: win rate, P&L, profit factor, expectancy, avg R, drawdown, avg
 * winner/loser). Filters trades by whichever field name is passed
 * ('strategy' or 'playbook') and reuses the exact same computation the
 * dashboard uses — no separate/divergent math.
 */
export async function getPerformanceFor(field, id, userId) {
  const filters = { userId, ...(field === 'strategy' ? { strategy: id } : { playbook: id }) };
  const trades = await analyticsService.getFilteredTrades(filters);
  const closed = analyticsService.closedOnly(trades);
  const summary = analyticsService.computeSummary(trades);
  const equityCurve = analyticsService.buildEquityCurve(closed);
  const { maxDrawdown } = analyticsService.buildDrawdownCurve(equityCurve);
  summary.maxDrawdown = closed.length ? maxDrawdown : null;
  return summary;
}

export default { getPerformanceFor };
