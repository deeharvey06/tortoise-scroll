import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as legacy from '../src/services/analyticsService.js';
import { streamAnalytics } from '../src/services/analytics/streaming.js';
import { adoptCandidates } from '../src/services/analytics/scalable.js';
import { analyticsMatch } from '../src/services/analytics/aggregation.js';
import { generatedTrade, owner } from './fixtures/analytics/generated.js';

import { referenceDashboard } from './fixtures/analytics/reference.js';

for (const count of [0, 1, 20, 1000])
  test(`streamed reference parity for ${count} trades`, async () => {
    const trades = Array.from({ length: count }, (_, i) => generatedTrade(i));
    assert.deepEqual(
      await streamAnalytics(trades, 1234.56),
      referenceDashboard(trades, 1234.56)
    );
    assert.deepEqual(
      await streamAnalytics(trades, 0, { mode: 'calendar' }),
      legacy.buildDailyStats(legacy.closedOnly(trades))
    );
  });
test('precision boundaries, missing values, ties, first-point drawdown and strategy identity remain unchanged', async () => {
  const trades = Array.from({ length: 6 }, (_, i) => ({
    ...generatedTrade(i),
    netPnL: [-0.005, 0.005, 1e20, -1e20, 0.1, 0.2][i],
    exitTime: new Date('2025-01-01T00:00:00Z'),
    rMultiple: [0.1, 0.2, -0.3, 1.005, null, 0][i],
    holdingTimeSeconds: [0.1, 0.2, 0.3, null, 0, 1][i],
  }));
  assert.deepEqual(await streamAnalytics(trades), referenceDashboard(trades));
});
test('only exactly equal aggregation values are adopted, including concurrent read differences', () => {
  const reference = {
    summary: { netPnL: 0.3, maxDrawdown: -1 },
    dailyStats: [{ avgR: 0.15000000000000002 }],
  };
  const diagnostics = {};
  assert.deepEqual(
    adoptCandidates(
      reference,
      { summary: { netPnL: 0.3 }, dailyStats: [{ avgR: 0.15 }] },
      { diagnostics }
    ),
    reference
  );
  assert.deepEqual(diagnostics, {
    summary: 'aggregation',
    dailyStats: 'compatibility',
  });
});
test('aggregate matching rejects missing owner and casts all owner/reference/date filters', () => {
  assert.throws(() => analyticsMatch({}), /authenticated owner/);
  assert.throws(() => analyticsMatch({ userId: 'invalid' }));
  const match = analyticsMatch({
    userId: String(owner),
    dateFrom: '2025-01-01',
    symbol: 'es',
  });
  assert.equal(match.userId.toString(), String(owner));
  assert.ok(match.entryTime.$gte instanceof Date);
  assert.equal(match.symbol, 'ES');
});

test('summary-only path matches legacy summary/distributions without chart payloads', async () => {
  const trades = Array.from({ length: 500 }, (_, i) => generatedTrade(i));
  const full = referenceDashboard(trades, 1234.56);
  assert.deepEqual(
    await streamAnalytics(trades, 1234.56, { mode: 'summary' }),
    {
      summary: full.summary,
      winLossDistribution: full.winLossDistribution,
      rMultipleDistribution: full.rMultipleDistribution,
    }
  );
});
test('150,000 winning trades do not overflow spread argument limits', async () => {
  async function* trades() {
    for (let i = 0; i < 150000; i++)
      yield {
        _id: i,
        symbol: 'TEST',
        netPnL: 0.1,
        grossPnL: 0.2,
        rMultiple: 0.1,
        exitTime: new Date(0),
        entryTime: new Date(0),
      };
  }
  const result = await streamAnalytics(trades(), 0, { mode: 'summary' });
  assert.equal(result.summary.totalTrades, 150000);
  assert.equal(result.summary.netPnL, 15000);
  assert.equal(result.summary.avgR, 0.1);
  assert.equal(result.summary.largestWinner, 0.1);
  assert.equal(result.summary.maxDrawdown, 0);
});

test('market report uses the same group outputs without retaining chart rows', async () => {
  const trades = Array.from({ length: 1000 }, (_, i) => generatedTrade(i));
  const full = referenceDashboard(trades);
  const expected = { sampleSize: full.summary.closedTrades };
  for (const key of [
    'bySymbol',
    'byStrategy',
    'bySetup',
    'bySession',
    'byDirection',
    'byDayOfWeek',
    'byHour',
  ])
    expected[key] = full[key];
  assert.deepEqual(
    await streamAnalytics(trades, 0, { mode: 'market' }),
    expected
  );
});
