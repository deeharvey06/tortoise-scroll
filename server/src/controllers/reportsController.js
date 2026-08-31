import * as analyticsService from '../services/analyticsService.js';

function extractFilters(req) {
  const { accountId, symbol, strategy, setup, direction, session, tags, dateFrom, dateTo } = req.query;
  return { accountId, symbol, strategy, setup, direction, session, tags, dateFrom, dateTo };
}

/**
 * One endpoint per report category (spec section 13). Each report is built
 * from the same closed-trade set as the dashboard — no separate/divergent
 * calculation path — and every "behavior" figure states its sample size
 * rather than asserting a pattern the data can't support.
 */
export async function getReport(req, res) {
  const { category } = req.params;
  const filters = extractFilters(req);
  const trades = await analyticsService.getFilteredTrades(filters);
  const closed = analyticsService.closedOnly(trades);

  if (category === 'performance') {
    const equityCurve = analyticsService.buildEquityCurve(closed);
    const { maxDrawdown } = analyticsService.buildDrawdownCurve(equityCurve);
    const summary = analyticsService.computeSummary(trades);
    summary.maxDrawdown = closed.length ? maxDrawdown : null;
    res.json({
      summary,
      winLossDistribution: analyticsService.buildWinLossDistribution(closed),
      rMultipleDistribution: analyticsService.buildRMultipleDistribution(closed),
    });
    return;
  }

  if (category === 'execution') {
    const holdingTimes = closed
      .filter((t) => t.holdingTimeSeconds !== null && t.holdingTimeSeconds !== undefined)
      .map((t) => t.holdingTimeSeconds);
    res.json({
      sampleSize: closed.length,
      byHour: analyticsService.buildByHour(closed),
      holdingTimeStats: {
        count: holdingTimes.length,
        avgSeconds: holdingTimes.length ? Math.round(holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length) : null,
        minSeconds: holdingTimes.length ? Math.min(...holdingTimes) : null,
        maxSeconds: holdingTimes.length ? Math.max(...holdingTimes) : null,
      },
      note:
        'Early-exit / late-entry detection requires a defined plan to compare against (planned entry/exit price or timing). ' +
        'That comparison arrives once Strategies and Playbooks (Phase 4) can attach a plan to a trade.',
    });
    return;
  }

  if (category === 'behavior') {
    res.json({
      sampleSize: closed.length,
      mistakes: analyticsService.computeTagBreakdown(closed, 'mistake'),
      emotions: analyticsService.computeTagBreakdown(closed, 'emotion'),
      ruleViolations: analyticsService.computeRuleViolations(closed),
      streaks: analyticsService.computeStreaks(closed),
      tradesPerDay: analyticsService.computeTradesPerDay(closed),
      note:
        'Figures below are frequencies and associated average P&L for tags you applied yourself — they describe what happened, ' +
        'not why. Treat any pattern with a small sample size (shown per row) with proportional skepticism.',
    });
    return;
  }

  if (category === 'market') {
    res.json({
      sampleSize: closed.length,
      bySymbol: analyticsService.buildBySymbol(closed),
      bySession: analyticsService.buildBySession(closed),
      byHour: analyticsService.buildByHour(closed),
      byDayOfWeek: analyticsService.buildByDayOfWeek(closed),
      byDirection: analyticsService.buildByDirection(closed),
      byStrategy: analyticsService.buildByStrategy(closed),
      bySetup: analyticsService.buildBySetup(closed),
    });
    return;
  }

  res.status(404);
  throw new Error(`Unknown report category "${category}". Expected performance, execution, behavior, or market.`);
}

export default { getReport };
