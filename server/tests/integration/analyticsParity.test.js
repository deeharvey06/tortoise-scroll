import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Trade from '../../src/models/Trade.js';
import {
  getFilteredTrades,
  buildDailyStats,
  closedOnly,
} from '../../src/services/analyticsService.js';
import { getScalableAnalytics } from '../../src/services/analytics/scalable.js';
import { aggregateCandidates } from '../../src/services/analytics/aggregation.js';
import {
  generatedTrade,
  owner,
  otherOwner,
  accounts,
  strategies,
} from '../fixtures/analytics/generated.js';
import { referenceDashboard } from '../fixtures/analytics/reference.js';

// Never reads server/.env or MONGO_URI, never drops a pre-existing database.
const dbName = `tortoise-analytics-test-${process.pid}-${Date.now()}`;
test(
  'MongoDB aggregation parity and isolation on representative and 100k datasets',
  { timeout: 240000 },
  async (t) => {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${dbName}`, {
      serverSelectionTimeoutMS: 10000,
    });
    try {
      await Trade.createIndexes();
      async function parity(filters, balance = 0) {
        const trades = await getFilteredTrades(filters),
          expected = referenceDashboard(trades, balance),
          diagnostics = {};
        const actual = await getScalableAnalytics(filters, balance, {
          diagnostics,
          compareAllAggregates: true,
        });
        assert.deepEqual(actual, expected);
        return diagnostics;
      }
      await t.test('empty and unknown/foreign accounts', async () => {
        await parity({ userId: owner });
        await parity({
          userId: owner,
          accountId: new mongoose.Types.ObjectId(),
        });
      });
      await Trade.collection.insertOne(generatedTrade(1));
      await t.test('one losing closed trade and starting balance', async () => {
        await parity({ userId: owner }, 10000.01);
      });
      await Trade.collection.insertMany(
        Array.from({ length: 200 }, (_, i) => generatedTrade(i + 2))
      );
      await Trade.collection.insertMany(
        Array.from({ length: 50 }, (_, i) => generatedTrade(i, otherOwner))
      );
      await t.test(
        'wins, losses, breakeven, open, missing R, accounts, strategies, sessions and filters',
        async () => {
          for (const filters of [
            {},
            { accountId: String(accounts[0]) },
            { strategy: String(strategies[0]) },
            { session: 'open' },
            { dateFrom: '2025-01-10', dateTo: '2025-02-01' },
            {
              accountId: String(accounts[1]),
              symbol: 'nq',
              direction: 'long',
              tags: 'review',
            },
            { setup: 'Breakout' },
          ])
            await parity({ ...filters, userId: String(owner) });
          const diagnostics = await parity({ userId: owner });
          assert.equal(diagnostics.summary, 'aggregation');
          assert.equal(diagnostics.rMultipleDistribution, 'aggregation');
          assert.equal(diagnostics.byStrategy, 'compatibility'); // Explicitly detected pre-existing ObjectId identity behavior.
        }
      );
      await t.test(
        'owner isolation and owner required before aggregation',
        async () => {
          await parity({ userId: otherOwner });
          await assert.rejects(
            getScalableAnalytics({ accountId: accounts[0] }),
            /authenticated owner/
          );
          const rows = await getScalableAnalytics({
            userId: owner,
            accountId: otherOwner,
          });
          assert.equal(rows.summary.totalTrades, 0);
        }
      );
      await t.test(
        'calendar keeps entry-month filtering, exit-day grouping, and exact binary R',
        async () => {
          const filters = {
            userId: owner,
            dateFrom: '2025-01-01T00:00:00Z',
            dateTo: '2025-01-31T23:59:59Z',
          };
          assert.deepEqual(
            await getScalableAnalytics(filters, 0, { mode: 'calendar' }),
            buildDailyStats(closedOnly(await getFilteredTrades(filters)))
          );
        }
      );
      await t.test(
        'pure compact candidate parity on exact arithmetic fixtures',
        async () => {
          const filters = {
            userId: owner,
            symbol: 'NQ',
            dateFrom: '2025-01-02',
            dateTo: '2025-01-02T23:59:59Z',
          };
          const expected = referenceDashboard(await getFilteredTrades(filters));
          const candidate = await aggregateCandidates(filters);
          delete expected.summary.maxDrawdown;
          for (const key of Object.keys(candidate))
            assert.deepEqual(candidate[key], expected[key], key);
        }
      );
      await t.test(
        'Decimal precision and half-up boundaries use exact fallback when Mongo differs',
        async () => {
          const boundaryOwner = new mongoose.Types.ObjectId();
          const values = [1e20, 0.015, -1e20, -0.005, 0.1, 0.2];
          await Trade.collection.insertMany(
            values.map((netPnL, i) => ({
              ...generatedTrade(200000 + i, boundaryOwner),
              userId: boundaryOwner,
              netPnL,
              grossPnL: netPnL,
              rMultiple: [0.1, 0.2, -0.3, 1.005, 0, null][i],
              exitTime: new Date('2025-03-01T00:00:00Z'),
            }))
          );
          const diagnostics = await parity({ userId: boundaryOwner });
          assert.equal(diagnostics.summary, 'compatibility');
        }
      );
      for (let offset = 202; offset < 100001; offset += 2000) {
        await Trade.collection.insertMany(
          Array.from({ length: Math.min(2000, 100001 - offset) }, (_, i) =>
            generatedTrade(offset + i)
          )
        );
      }
      await t.test(
        '100,000 trades: exact full response parity and reproducibility',
        async () => {
          assert.equal(await Trade.countDocuments({ userId: owner }), 100000);
          const diagnostics = await parity({ userId: owner });
          assert.equal(diagnostics.summary, 'aggregation');
          assert.equal(diagnostics.winLossDistribution, 'aggregation');
          assert.equal(diagnostics.rMultipleDistribution, 'aggregation');
          const filters = {
            userId: owner,
            accountId: accounts[0],
            dateFrom: '2025-02-01',
            dateTo: '2025-02-28',
          };
          assert.deepEqual(
            await getScalableAnalytics(filters),
            await getScalableAnalytics(filters)
          );
        }
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
