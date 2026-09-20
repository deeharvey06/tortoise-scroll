import { isDeepStrictEqual } from 'node:util';
import Trade from '../../models/Trade.js';
import { analyticsMatch, aggregateCandidates } from './aggregation.js';
import { streamAnalytics } from './streaming.js';

// Includes every value used by the reference calculations, but excludes fills,
// notes, screenshots, methodology, and unused trade-list fields.
export const ANALYTICS_PROJECTION =
  '_id symbol strategy setup session direction entryTime exitTime netPnL grossPnL rMultiple holdingTimeSeconds';

/** Adopt only exact candidates. The compatibility result is authoritative,
 * including order, nulls, binary R arithmetic, and concurrent-write differences.
 * diagnostics is internal instrumentation, never a change to the public DTO.
 */
export function adoptCandidates(
  reference,
  candidates,
  { mode = 'dashboard', diagnostics } = {}
) {
  const result =
    mode === 'calendar' ? { dailyStats: reference } : { ...reference };
  for (const [key, candidate] of Object.entries(candidates)) {
    const value =
      key === 'summary'
        ? { ...candidate, maxDrawdown: reference.summary.maxDrawdown }
        : candidate;
    const equal = isDeepStrictEqual(value, result[key]);
    if (diagnostics) diagnostics[key] = equal ? 'aggregation' : 'compatibility';
    if (equal) result[key] = value;
  }
  return mode === 'calendar' ? result.dailyStats : result;
}
export async function getScalableAnalytics(
  filters,
  startingBalance = 0,
  options = {}
) {
  const match = analyticsMatch(filters);
  // Sequential reads bound DB concurrency. Do not use a client-controlled flag.
  // Full grouped pipelines remain available for parity/benchmark work. Their
  // extra scans did not improve latency; daily binary R and ObjectId grouping
  // also need compatibility. Production adopts compact KPI/distribution only.
  const candidates = options.compareAllAggregates
    ? await aggregateCandidates(filters, options)
    : ['calendar', 'market'].includes(options.mode)
      ? {}
      : await aggregateCandidates(filters, { mode: 'summary' });
  const cursor = Trade.find(match)
    .select(ANALYTICS_PROJECTION)
    .lean()
    .cursor({ batchSize: 512 });
  let reference;
  try {
    reference = await streamAnalytics(cursor, startingBalance, options);
  } finally {
    await cursor.close();
  }
  return adoptCandidates(reference, candidates, options);
}
