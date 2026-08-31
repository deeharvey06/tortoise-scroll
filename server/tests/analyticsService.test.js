import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closedOnly,
  computeSummary,
  buildEquityCurve,
  buildDrawdownCurve,
  buildDailyStats,
  buildWinLossDistribution,
  buildRMultipleDistribution,
  buildBySymbol,
  buildBySetup,
  computeStreaks,
  computeTagBreakdown,
  computeRuleViolations,
} from '../src/services/analyticsService.js';

// Fixed sample set used across every test below, so expected values can be
// hand-verified once and reused. Mirrors the scenario manually verified
// during development (2 wins, 1 loss, 1 still-open trade).
const trades = [
  {
    _id: '1', symbol: 'AAPL', direction: 'long', netPnL: 150, grossPnL: 150, rMultiple: 1.5,
    entryTime: '2026-08-20T14:30:00Z', exitTime: '2026-08-20T14:45:00Z', holdingTimeSeconds: 900,
    setup: 'Breakout', session: 'open', tags: [], mistake: [], emotion: [], followedPlan: true,
  },
  {
    _id: '2', symbol: 'TSLA', direction: 'short', netPnL: -80, grossPnL: -80, rMultiple: -0.8,
    entryTime: '2026-08-21T10:00:00Z', exitTime: '2026-08-21T10:20:00Z', holdingTimeSeconds: 1200,
    setup: 'Reversal', session: 'open', tags: [], mistake: ['FOMO'], emotion: [], followedPlan: false,
  },
  {
    _id: '3', symbol: 'MSFT', direction: 'long', netPnL: 60, grossPnL: 60, rMultiple: 0.6,
    entryTime: '2026-08-22T09:40:00Z', exitTime: '2026-08-22T09:55:00Z', holdingTimeSeconds: 900,
    setup: 'Breakout', session: 'pre-market', tags: [], mistake: [], emotion: [], followedPlan: true,
  },
  {
    _id: '4', symbol: 'AAPL', direction: 'long', netPnL: null, grossPnL: null, rMultiple: null,
    entryTime: '2026-08-23T09:40:00Z', exitTime: null, holdingTimeSeconds: null,
    setup: 'Breakout', session: 'open', tags: [], mistake: [], emotion: [], followedPlan: null,
  },
];

test('closedOnly excludes trades with no exit', () => {
  const closed = closedOnly(trades);
  assert.equal(closed.length, 3);
  assert.ok(!closed.some((t) => t._id === '4'));
});

test('computeSummary produces correct win rate, profit factor, expectancy, avg R', () => {
  const summary = computeSummary(trades);
  assert.equal(summary.totalTrades, 4);
  assert.equal(summary.closedTrades, 3);
  assert.equal(summary.openTrades, 1);
  assert.equal(summary.winningTrades, 2);
  assert.equal(summary.losingTrades, 1);
  assert.equal(summary.netPnL, 130);
  assert.equal(summary.grossPnL, 130);
  assert.equal(summary.winRate, 66.67);
  assert.equal(summary.lossRate, 33.33);
  assert.equal(summary.profitFactor, 2.63); // 210 / 80
  assert.equal(summary.avgWin, 105);
  assert.equal(summary.avgLoss, -80);
  assert.equal(summary.expectancy, 43.33); // 130 / 3
  assert.equal(summary.avgR, 0.433); // (1.5 - 0.8 + 0.6) / 3
  assert.equal(summary.largestWinner, 150);
  assert.equal(summary.largestLoser, -80);
  assert.equal(summary.avgHoldingTimeSeconds, 1000);
});

test('computeSummary returns null (not 0) stats for an all-open trade set', () => {
  const allOpen = [trades[3]];
  const summary = computeSummary(allOpen);
  assert.equal(summary.netPnL, null);
  assert.equal(summary.winRate, null);
  assert.equal(summary.profitFactor, null);
});

test('buildEquityCurve produces the correct running total in chronological order', () => {
  const curve = buildEquityCurve(closedOnly(trades));
  assert.equal(curve.length, 3);
  assert.equal(curve[0].equity, 150); // AAPL first (Aug 20)
  assert.equal(curve[1].equity, 70); // + TSLA (-80)
  assert.equal(curve[2].equity, 130); // + MSFT (+60)
});

test('buildDrawdownCurve correctly identifies the trough after a losing trade', () => {
  const curve = buildEquityCurve(closedOnly(trades));
  const { curve: dd, maxDrawdown } = buildDrawdownCurve(curve);
  assert.equal(dd[0].drawdown, 0); // at the peak
  assert.equal(dd[1].drawdown, -80); // 70 - peak(150)
  assert.equal(dd[2].drawdown, -20); // 130 - peak(150)
  assert.equal(maxDrawdown, -80);
});

test('buildDailyStats groups by day with correct P&L and win rate', () => {
  const days = buildDailyStats(closedOnly(trades));
  assert.equal(days.length, 3);
  const aug20 = days.find((d) => d.date === '2026-08-20');
  assert.equal(aug20.netPnL, 150);
  assert.equal(aug20.winRate, 100);
  const aug21 = days.find((d) => d.date === '2026-08-21');
  assert.equal(aug21.netPnL, -80);
  assert.equal(aug21.winRate, 0);
});

test('win/loss distribution buckets values into the correct ranges', () => {
  const dist = buildWinLossDistribution(closedOnly(trades));
  const midHigh = dist.find((b) => b.label === '50 to 200');
  const midLow = dist.find((b) => b.label === '-200 to -50');
  assert.equal(midHigh.count, 2); // 150 and 60
  assert.equal(midLow.count, 1); // -80
});

test('R-multiple distribution buckets values into the correct ranges', () => {
  const dist = buildRMultipleDistribution(closedOnly(trades));
  const oneToTwo = dist.find((b) => b.label === '1 to 2');
  const negOneToZero = dist.find((b) => b.label === '-1 to 0');
  const zeroToOne = dist.find((b) => b.label === '0 to 1');
  assert.equal(oneToTwo.count, 1); // 1.5
  assert.equal(negOneToZero.count, 1); // -0.8
  assert.equal(zeroToOne.count, 1); // 0.6
});

test('buildBySymbol and buildBySetup group and sort by net P&L descending', () => {
  const bySymbol = buildBySymbol(closedOnly(trades));
  assert.equal(bySymbol[0].label, 'AAPL');
  assert.equal(bySymbol[0].netPnL, 150);
  assert.equal(bySymbol.find((s) => s.label === 'TSLA').netPnL, -80);

  const bySetup = buildBySetup(closedOnly(trades));
  const breakout = bySetup.find((s) => s.label === 'Breakout');
  assert.equal(breakout.count, 2); // AAPL + MSFT
  assert.equal(breakout.netPnL, 210);
});

test('computeStreaks tracks the longest loss streak and current streak correctly', () => {
  const streaks = computeStreaks(closedOnly(trades));
  assert.equal(streaks.longestLossStreak, 1);
  assert.equal(streaks.currentStreakType, 'win');
  assert.equal(streaks.currentStreak, 1);
  // Only one loss occurred, never two in a row, so this sample is empty —
  // must be reported as such, not a fabricated average.
  assert.equal(streaks.sampleSizeAfterTwoConsecutiveLosses, 0);
  assert.equal(streaks.avgRAfterTwoConsecutiveLosses, null);
});

test('computeTagBreakdown reports frequency and average P&L per tag', () => {
  const breakdown = computeTagBreakdown(closedOnly(trades), 'mistake');
  assert.equal(breakdown.length, 1);
  assert.equal(breakdown[0].tag, 'FOMO');
  assert.equal(breakdown[0].count, 1);
  assert.equal(breakdown[0].avgPnL, -80);
});

test('computeRuleViolations only counts trades where followedPlan was explicitly set', () => {
  const violations = computeRuleViolations(closedOnly(trades));
  assert.equal(violations.tradesWithPlanFlagSet, 3); // all 3 closed trades have it set
  assert.equal(violations.violations, 1); // TSLA trade
  assert.equal(violations.violationRate, 33); // 1/3 rounded to 0dp
});
