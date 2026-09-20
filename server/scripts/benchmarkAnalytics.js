/** Reproducible local-only benchmark. No dotenv/MONGO_URI; never touches user DBs. */
import mongoose from 'mongoose';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import Trade from '../src/models/Trade.js';
import {
  getFilteredTrades,
  buildDailyStats,
  closedOnly,
  computeSummary,
  buildEquityCurve,
  buildDrawdownCurve,
  buildWinLossDistribution,
  buildRMultipleDistribution,
} from '../src/services/analyticsService.js';
import { getScalableAnalytics } from '../src/services/analytics/scalable.js';
import {
  analyticsMatch,
  aggregateCandidates,
  summaryPipeline,
} from '../src/services/analytics/aggregation.js';
import {
  generatedTrade,
  owner,
  otherOwner,
  accounts,
} from '../tests/fixtures/analytics/generated.js';
import { referenceDashboard } from '../tests/fixtures/analytics/reference.js';

const worker = process.argv[2] === '--worker';
const dbName = worker
  ? process.argv[3]
  : `tortoise-analytics-test-benchmark-${process.pid}-${Date.now()}`;
if (!/^tortoise-analytics-test-benchmark-\d+-\d+$/.test(dbName))
  throw new Error('Refusing non-benchmark database');
await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, {
  serverSelectionTimeoutMS: 10000,
});
try {
  if (worker) {
    const mode = process.argv[4];
    global.gc?.();
    const before = process.memoryUsage();
    const started = performance.now();
    const filters = {
      userId: owner,
      ...(mode.includes('calendar')
        ? { dateFrom: '2025-02-01', dateTo: '2025-02-28T23:59:59Z' }
        : {}),
    };
    let result;
    if (mode === 'legacy-dashboard')
      result = referenceDashboard(await getFilteredTrades(filters));
    else if (mode === 'legacy-calendar')
      result = buildDailyStats(closedOnly(await getFilteredTrades(filters)));
    else if (mode === 'legacy-summary') {
      const trades = await getFilteredTrades(filters),
        closed = closedOnly(trades);
      const { maxDrawdown } = buildDrawdownCurve(buildEquityCurve(closed));
      result = {
        summary: {
          ...computeSummary(trades),
          maxDrawdown: closed.length ? maxDrawdown : null,
        },
        winLossDistribution: buildWinLossDistribution(closed),
        rMultipleDistribution: buildRMultipleDistribution(closed),
      };
    } else if (mode === 'candidate')
      result = await aggregateCandidates(filters);
    else
      result = await getScalableAnalytics(filters, 0, {
        mode: mode.includes('calendar')
          ? 'calendar'
          : mode.includes('summary')
            ? 'summary'
            : 'dashboard',
      });
    const computeMs = performance.now() - started;
    const memory = process.memoryUsage();
    const payloadBytes = Buffer.byteLength(JSON.stringify(result));
    process.send({
      mode,
      computeMs: Math.round(computeMs),
      responseMs: Math.round(performance.now() - started),
      heapDeltaMiB: +((memory.heapUsed - before.heapUsed) / 1048576).toFixed(2),
      peakRssMiB: +(process.resourceUsage().maxRSS / 1024).toFixed(2),
      payloadBytes,
    });
  } else {
    const count = Number(process.env.ANALYTICS_BENCHMARK_COUNT || 100000);
    if (!Number.isInteger(count) || count < 1 || count > 1000000)
      throw new Error('Benchmark count must be 1..1000000');
    await Trade.createIndexes();
    for (let start = 0; start < count; start += 2000)
      await Trade.collection.insertMany(
        Array.from({ length: Math.min(2000, count - start) }, (_, i) =>
          generatedTrade(start + i)
        )
      );
    await Trade.collection.insertMany(
      Array.from({ length: 1000 }, (_, i) => generatedTrade(i, otherOwner))
    );
    const filter = {
      userId: owner,
      dateFrom: '2025-02-01',
      dateTo: '2025-02-28T23:59:59Z',
    };
    const explain = async (filters) => {
      const raw = await Trade.find(analyticsMatch(filters))
        .select('_id netPnL entryTime exitTime')
        .explain('executionStats');
      return {
        returned: raw.executionStats.nReturned,
        documentsExamined: raw.executionStats.totalDocsExamined,
        keysExamined: raw.executionStats.totalKeysExamined,
        executionMs: raw.executionStats.executionTimeMillis,
        plan: raw.queryPlanner.winningPlan,
      };
    };
    const before = await explain(filter);
    await Trade.collection.createIndex(
      { userId: 1, entryTime: -1 },
      { name: 'analytics_owner_entry_time' }
    );
    const after = await explain(filter);
    const accountRange = await explain({ ...filter, accountId: accounts[0] });
    const aggregateExplain = await Trade.aggregate(
      summaryPipeline(analyticsMatch(filter))
    ).explain('executionStats');
    // Time the actual deployed index set, not the rejected candidate.
    await Trade.collection.dropIndex('analytics_owner_entry_time');
    const results = [];
    for (const mode of [
      'legacy-dashboard',
      'scalable-dashboard',
      'legacy-calendar',
      'scalable-calendar',
      'legacy-summary',
      'scalable-summary',
      'candidate',
    ]) {
      for (let run = 0; run < 3; run++) {
        const result = await new Promise((resolve, reject) => {
          const child = fork(
            fileURLToPath(import.meta.url),
            ['--worker', dbName, mode],
            {
              execArgv: ['--expose-gc'],
              stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
            }
          );
          let message;
          child.on('message', (data) => {
            message = data;
          });
          child.on('error', reject);
          child.on('exit', (code) =>
            code === 0 && message
              ? resolve(message)
              : reject(new Error(`Benchmark worker failed: ${code}`))
          );
        });
        results.push({ run: run + 1, ...result });
        console.log(JSON.stringify(results.at(-1)));
      }
    }
    const report = {
      generatedAt: new Date().toISOString(),
      node: process.version,
      mongo: (await mongoose.connection.db.admin().serverInfo()).version,
      platform: `${process.platform}/${process.arch}`,
      count,
      foreignCount: 1000,
      before,
      after,
      accountRange,
      aggregateExplain,
      results,
    };
    await writeFile(
      process.env.ANALYTICS_BENCHMARK_OUTPUT ||
        '/tmp/tortoise-phase8-benchmark.json',
      JSON.stringify(report, null, 2)
    );
  }
} finally {
  if (!worker) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
