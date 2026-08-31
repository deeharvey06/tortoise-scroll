import * as analyticsService from '../services/analyticsService.js';
import Strategy from '../models/Strategy.js';
import Playbook from '../models/Playbook.js';

/**
 * Compares the user's most recent N closed trades against the N before
 * that — directly answers "compare my last 30 trades to the previous 30"
 * style questions with real numbers instead of the model guessing.
 */
function compareRecentBatches(closedTrades, n = 30) {
  const sorted = [...closedTrades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
  const recent = sorted.slice(-n);
  const previous = sorted.slice(-2 * n, -n);
  if (recent.length === 0) return null;
  return {
    batchSize: n,
    recent: { ...analyticsService.computeSummary(recent), sampleSize: recent.length },
    previous: previous.length ? { ...analyticsService.computeSummary(previous), sampleSize: previous.length } : null,
    note:
      previous.length < n
        ? `Only ${previous.length} trade(s) exist before the most recent ${recent.length} — the "previous" comparison batch is smaller than requested.`
        : null,
  };
}

/**
 * Builds the full deterministic data bundle handed to the AI as context.
 * Every number in here comes from the same analyticsService used by the
 * Dashboard/Reports pages — there is exactly one calculation path in this
 * app, and the AI never gets to run its own math.
 */
export async function buildContextBundle(filters = {}) {
  const trades = await analyticsService.getFilteredTrades(filters);
  const closed = analyticsService.closedOnly(trades);

  const [strategies, playbooks] = await Promise.all([
    Strategy.find().select('name').lean(),
    Playbook.find().select('setupName').lean(),
  ]);
  const strategyNameById = Object.fromEntries(strategies.map((s) => [String(s._id), s.name]));
  const playbookNameById = Object.fromEntries(playbooks.map((p) => [String(p._id), p.setupName]));

  const summary = analyticsService.computeSummary(trades);
  const equityCurve = analyticsService.buildEquityCurve(closed);
  const { maxDrawdown } = analyticsService.buildDrawdownCurve(equityCurve);
  summary.maxDrawdown = closed.length ? maxDrawdown : null;

  const recentTrades = [...closed]
    .sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))
    .slice(0, 10)
    .map((t) => ({
      symbol: t.symbol,
      direction: t.direction,
      netPnL: t.netPnL,
      rMultiple: t.rMultiple,
      setup: t.setup,
      strategy: t.strategy ? strategyNameById[String(t.strategy)] || null : null,
      playbook: t.playbook ? playbookNameById[String(t.playbook)] || null : null,
      session: t.session,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      mistake: t.mistake,
      emotion: t.emotion,
      followedPlan: t.followedPlan,
    }));

  return {
    generatedAt: new Date().toISOString(),
    filtersApplied: filters,
    sampleSizeNote:
      'Every group below reports its own trade count. Treat any group with fewer than ~10 trades as too small to draw a confident conclusion from.',
    summary,
    bySymbol: analyticsService.buildBySymbol(closed),
    byStrategy: analyticsService.buildByStrategy(closed).map((g) => ({ ...g, label: strategyNameById[g.key] || g.label })),
    bySetup: analyticsService.buildBySetup(closed),
    bySession: analyticsService.buildBySession(closed),
    byDirection: analyticsService.buildByDirection(closed),
    byDayOfWeek: analyticsService.buildByDayOfWeek(closed),
    byHour: analyticsService.buildByHour(closed),
    streaks: analyticsService.computeStreaks(closed),
    mistakeBreakdown: analyticsService.computeTagBreakdown(closed, 'mistake'),
    emotionBreakdown: analyticsService.computeTagBreakdown(closed, 'emotion'),
    ruleViolations: analyticsService.computeRuleViolations(closed),
    recentVsPreviousThirty: compareRecentBatches(closed, 30),
    recentTrades,
  };
}

export default { buildContextBundle };
