import * as analyticsService from '../services/analyticsService.js';
import Strategy from '../models/Strategy.js';
import RiskSettings from '../models/RiskSettings.js';
import JournalEntry from '../models/JournalEntry.js';
import { narrate } from './narrate.js';

/**
 * Builds a pre-market briefing from the user's own history — NOT from any
 * live market data, which this app has no source for. Per spec section 20
 * Agent 3: "Do NOT provide fabricated market information. If real-time
 * market data is not connected, clearly state that." That statement is
 * always included, unconditionally, as the first finding.
 */
export async function computePreMarketBriefing(filters = {}) {
  const trades = await analyticsService.getFilteredTrades(filters);
  const closed = analyticsService.closedOnly(trades);
  const recent30 = [...closed].sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime)).slice(0, 30);

  const summary = analyticsService.computeSummary(recent30);
  const streaks = analyticsService.computeStreaks(closed);
  const mistakes = analyticsService.computeTagBreakdown(recent30, 'mistake').slice(0, 3);

  const [strategies, riskSettings, lastPostMarket] = await Promise.all([
    Strategy.find({ isActive: true }).select('name').lean(),
    RiskSettings.findOne(filters.accountId ? { accountId: filters.accountId } : { accountId: null }).lean(),
    JournalEntry.findOne({ type: 'post-market' }).sort({ date: -1 }).lean(),
  ]);

  const findings = [
    'No real-time market data is connected to this app — this briefing is based entirely on your own trading history, not current market conditions.',
    recent30.length > 0
      ? `Over your last ${recent30.length} closed trade(s): net P&L $${summary.netPnL?.toFixed(2)}, win rate ${summary.winRate}%, avg R ${summary.avgR !== null ? summary.avgR.toFixed(2) + 'R' : 'n/a'}.`
      : 'You have no closed trades yet to summarize recent performance from.',
    streaks.currentStreakType === 'loss' && streaks.currentStreak >= 2
      ? `You're currently on a ${streaks.currentStreak}-trade losing streak — worth deciding your sizing/approach for this before the session starts.`
      : null,
    strategies.length > 0
      ? `Active strategies: ${strategies.map((s) => s.name).join(', ')}.`
      : 'No active strategies are defined yet — consider setting one up on the Strategies page.',
    mistakes.length > 0
      ? `Recent recurring mistakes (last ${recent30.length} trades): ${mistakes.map((m) => `"${m.tag}" (${m.count}x)`).join(', ')}.`
      : null,
    riskSettings?.maxDailyLoss
      ? `Your configured max daily loss limit is $${riskSettings.maxDailyLoss}.`
      : 'No max daily loss limit is configured on the Risk page yet.',
    riskSettings?.maxTradesPerDay ? `Your configured max trades per day is ${riskSettings.maxTradesPerDay}.` : null,
    lastPostMarket
      ? `Your most recent post-market review (${new Date(lastPostMarket.date).toDateString()}) is available in the Journal for reference.`
      : null,
  ].filter(Boolean);

  return { summary, streaks, strategies: strategies.map((s) => s.name), riskSettings, findings };
}

export async function generatePreMarketBriefing(filters = {}) {
  const briefing = await computePreMarketBriefing(filters);
  const narrative = await narrate(briefing.findings, { title: 'Pre-Market Briefing' });
  return { ...briefing, narrative };
}

export default { computePreMarketBriefing, generatePreMarketBriefing };
