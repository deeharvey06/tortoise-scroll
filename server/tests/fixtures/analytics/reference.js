import * as legacy from '../../../src/services/analyticsService.js';
export function referenceDashboard(trades, startingBalance = 0) {
  const closed = legacy.closedOnly(trades);
  const equityCurve = legacy.buildEquityCurve(closed, startingBalance);
  const { curve: drawdownCurve, maxDrawdown } =
    legacy.buildDrawdownCurve(equityCurve);
  return {
    summary: {
      ...legacy.computeSummary(trades),
      maxDrawdown: closed.length ? maxDrawdown : null,
    },
    equityCurve,
    drawdownCurve,
    dailyStats: legacy.buildDailyStats(closed),
    winLossDistribution: legacy.buildWinLossDistribution(closed),
    rMultipleDistribution: legacy.buildRMultipleDistribution(closed),
    byDayOfWeek: legacy.buildByDayOfWeek(closed),
    byHour: legacy.buildByHour(closed),
    bySymbol: legacy.buildBySymbol(closed),
    byStrategy: legacy.buildByStrategy(closed),
    bySetup: legacy.buildBySetup(closed),
    bySession: legacy.buildBySession(closed),
    byDirection: legacy.buildByDirection(closed),
  };
}
