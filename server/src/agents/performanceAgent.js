import * as analyticsService from '../services/analyticsService.js';
import { narrate } from './narrate.js';

const MIN_SAMPLE_SIZE = 10;
const MIN_TAG_SAMPLE_SIZE = 5;
const WIN_RATE_DELTA_THRESHOLD = 15;
const AVG_R_DELTA_THRESHOLD = 0.3;

export function findDeviations(groups, overall, dimensionLabel) {
  const findings = [];
  for (const g of groups) {
    if (g.count < MIN_SAMPLE_SIZE) continue;

    if (overall.winRate !== null && g.winRate !== null) {
      const delta = g.winRate - overall.winRate;
      if (Math.abs(delta) >= WIN_RATE_DELTA_THRESHOLD) {
        const direction = delta > 0 ? 'significantly better' : 'significantly worse';
        findings.push(
          `Your win rate is ${direction} for ${dimensionLabel} "${g.label}": ${g.winRate}% over ${g.count} trades, ` +
            `vs your overall ${overall.winRate}% over ${overall.closedTrades} trades.`
        );
      }
    }
    if (overall.avgR !== null && g.avgR !== null) {
      const delta = g.avgR - overall.avgR;
      if (Math.abs(delta) >= AVG_R_DELTA_THRESHOLD) {
        const direction = delta > 0 ? 'notably higher' : 'notably lower';
        findings.push(
          `Your average R is ${direction} for ${dimensionLabel} "${g.label}": ${g.avgR.toFixed(2)}R over ${g.count} trades, ` +
            `vs your overall ${overall.avgR.toFixed(2)}R.`
        );
      }
    }
  }
  return findings;
}

export function tagAssociationFindings(closedTrades, field, label) {
  const breakdown = analyticsService.computeTagBreakdown(closedTrades, field);
  const findings = [];
  const overallAvg = closedTrades.length
    ? closedTrades.reduce((s, t) => s + t.netPnL, 0) / closedTrades.length
    : null;

  for (const tag of breakdown) {
    if (tag.count < MIN_TAG_SAMPLE_SIZE || overallAvg === null) continue;
    const delta = tag.avgPnL - overallAvg;
    if (Math.abs(delta) >= Math.abs(overallAvg) * 0.5 + 20) {
      findings.push(
        `Trades tagged "${tag.tag}" (${label}) average $${tag.avgPnL.toFixed(2)} over ${tag.count} trade(s), ` +
          `compared to your overall average of $${overallAvg.toFixed(2)} — this is an association observed in the data, not a proven cause.`
      );
    }
  }
  return findings;
}

export async function computePerformancePatterns(filters = {}) {
  const trades = await analyticsService.getFilteredTrades(filters);
  const closed = analyticsService.closedOnly(trades);
  const overall = analyticsService.computeSummary(trades);

  if (closed.length < MIN_SAMPLE_SIZE) {
    return {
      sampleSize: closed.length,
      findings: [
        `Only ${closed.length} closed trade(s) match the current filters — at least ${MIN_SAMPLE_SIZE} are needed before ` +
          'this agent will report any pattern, to avoid drawing conclusions from too little data.',
      ],
    };
  }

  const findings = [
    ...findDeviations(analyticsService.buildBySession(closed), overall, 'session'),
    ...findDeviations(analyticsService.buildByDayOfWeek(closed), overall, 'day of week'),
    ...findDeviations(analyticsService.buildByHour(closed), overall, 'hour'),
    ...findDeviations(analyticsService.buildByDirection(closed), overall, 'direction'),
    ...findDeviations(analyticsService.buildBySetup(closed), overall, 'setup'),
    ...tagAssociationFindings(closed, 'mistake', 'mistake'),
    ...tagAssociationFindings(closed, 'emotion', 'emotion'),
  ];

  const streaks = analyticsService.computeStreaks(closed);
  if (streaks.sampleSizeAfterTwoConsecutiveLosses >= MIN_TAG_SAMPLE_SIZE) {
    findings.push(
      `After 2+ consecutive losses, your average R over the next trade is ${streaks.avgRAfterTwoConsecutiveLosses}R ` +
        `(${streaks.sampleSizeAfterTwoConsecutiveLosses} instance(s)).`
    );
  }

  return {
    sampleSize: closed.length,
    overall,
    findings:
      findings.length > 0
        ? findings
        : [
            `No pattern crossed the significance thresholds (${WIN_RATE_DELTA_THRESHOLD}pp win rate / ${AVG_R_DELTA_THRESHOLD}R) ` +
              `across your ${closed.length} trades.`,
          ],
  };
}

export async function generatePerformancePatterns(filters = {}) {
  const result = await computePerformancePatterns(filters);
  const narrative = await narrate(result.findings, { title: 'Performance Patterns' });
  return { ...result, narrative };
}

export default { computePerformancePatterns, generatePerformancePatterns };
