import Decimal from 'decimal.js';
import {
  computeSummary,
  closedOnly,
  buildEquityCurve,
  buildDrawdownCurve,
} from '../analyticsService.js';
const known = (value) => typeof value === 'number' && Number.isFinite(value);
export function evaluateProcess(trade) {
  const context = trade.methodology || {};
  const plan = context.plan;
  const actual = {
    entry: trade.entryPrice ?? null,
    stop: trade.stopLoss ?? null,
    exit: trade.exitPrice ?? null,
    size: trade.quantity ?? null,
    risk: trade.riskAmount ?? null,
    entryType: context.actualEntryType || null,
    strategy: trade.strategy || null,
    playbook: trade.playbook || null,
  };
  const comparisons = [
    'entry',
    'stop',
    'exit',
    'size',
    'risk',
    'entryType',
    'strategy',
    'playbook',
  ].map((field) => ({
    field,
    planned: plan?.[field] ?? null,
    actual: actual[field],
    available: plan?.[field] != null && actual[field] != null,
  }));
  comparisons.push({
    field: 'target',
    planned: plan?.target ?? null,
    actual: actual.exit,
    available: plan?.target != null && actual.exit != null,
  });
  const findings = [];
  const add = (code, definition, evidence) =>
    findings.push({
      code,
      definition,
      evidence,
      origin: 'deterministic_comparison',
    });
  if (!plan)
    return {
      comparisons,
      findings,
      limitation: 'No recorded plan; no automatic execution classifications.',
    };
  if (
    known(plan.size) &&
    known(actual.size) &&
    new Decimal(actual.size).gt(plan.size)
  )
    add(
      'Oversized',
      'Recorded aggregate entry quantity exceeds planned quantity.',
      { planned: plan.size, actual: actual.size }
    );
  if (
    known(plan.risk) &&
    known(actual.risk) &&
    new Decimal(actual.risk).gt(plan.risk)
  )
    add(
      'Planned Risk Exceeded',
      'Recorded trade risk amount exceeds planned risk amount.',
      { planned: plan.risk, actual: actual.risk }
    );
  if (
    known(plan.stop) &&
    known(actual.stop) &&
    !new Decimal(actual.stop).eq(plan.stop)
  )
    add(
      'Stop Differs From Plan',
      'Current recorded stop differs from the planned stop; this does not prove when it changed.',
      { planned: plan.stop, actual: actual.stop }
    );
  const at = new Date(trade.entryTime).getTime();
  if (
    Number.isFinite(at) &&
    plan.earliestEntry &&
    at < Date.parse(plan.earliestEntry)
  )
    add(
      'Early Entry',
      'Entry timestamp precedes the explicitly planned earliest entry.',
      { planned: plan.earliestEntry, actual: trade.entryTime }
    );
  if (
    Number.isFinite(at) &&
    plan.latestEntry &&
    at > Date.parse(plan.latestEntry)
  )
    add(
      'Late Entry',
      'Entry timestamp follows the explicitly planned latest entry.',
      { planned: plan.latestEntry, actual: trade.entryTime }
    );
  if (
    known(plan.entry) &&
    known(actual.entry) &&
    known(plan.maxAdverseEntryDeviation)
  ) {
    const deviation = new Decimal(actual.entry)
      .minus(plan.entry)
      .times(trade.direction === 'short' ? -1 : 1);
    if (deviation.gt(plan.maxAdverseEntryDeviation))
      add(
        'Chased Entry',
        'Adverse entry-price deviation exceeds the user-defined price-unit threshold.',
        {
          planned: plan.entry,
          actual: actual.entry,
          threshold: plan.maxAdverseEntryDeviation,
          adverseDeviation: deviation.toNumber(),
        }
      );
  }
  if (plan.maxEntryFills != null && trade.executions?.length) {
    const side = trade.direction === 'short' ? 'sell' : 'buy';
    const count = trade.executions.filter((e) => e.side === side).length;
    if (count > plan.maxEntryFills)
      add(
        'Entry Fill Count Exceeded',
        'Recorded entry-side executions exceed the explicit fill-count limit; split fills are counted separately.',
        { limit: plan.maxEntryFills, count }
      );
  }
  return {
    comparisons,
    findings,
    limitation:
      'Recorded-plan comparison only. Plans may be recorded retrospectively; execution quantities are aggregate. Subjective setup/context judgments remain manual.',
    planRecordedAt: context.planRecordedAt,
    planTiming:
      context.planRecordedAt && Date.parse(context.planRecordedAt) <= at
        ? 'recorded_before_entry'
        : 'retrospective_or_unknown',
  };
}
export function contextStatistics(trades) {
  const closed = closedOnly(trades);
  const r = closed.filter((t) => known(t.rMultiple));
  const equityCurve = buildEquityCurve(closed);
  const drawdown = buildDrawdownCurve([
    { equity: 0, date: null },
    ...equityCurve,
  ]);
  return {
    ...computeSummary(trades),
    sampleSize: closed.length,
    rSampleSize: r.length,
    totalR: r.length
      ? r
          .reduce((sum, t) => sum.plus(t.rMultiple), new Decimal(0))
          .toDecimalPlaces(3)
          .toNumber()
      : null,
    maxDrawdown: closed.length ? drawdown.maxDrawdown : null,
    equityCurve,
    interpretation:
      'Observed personal sample; no statistical significance or methodology probability is implied.',
  };
}
export function matchesContext(trade, filters) {
  for (const [key, value] of Object.entries(filters.review || {}))
    if (trade.methodology?.review?.[key] !== value) return false;
  const selected = new Set(
    (trade.methodology?.snapshot || []).map((i) => String(i.knowledgeId))
  );
  if ((filters.knowledgeIds || []).some((id) => !selected.has(id)))
    return false;
  if (
    filters.followedPlan != null &&
    trade.followedPlan !== filters.followedPlan
  )
    return false;
  if (
    filters.scenarioMatched != null &&
    trade.methodology?.review?.scenarioMatched !== filters.scenarioMatched
  )
    return false;
  if (
    filters.process &&
    !evaluateProcess(trade).findings.some((f) => f.code === filters.process)
  )
    return false;
  return true;
}
