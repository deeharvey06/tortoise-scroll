import { getReport } from '../../src/controllers/reportsController.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import Trade from '../../src/models/Trade.js';
import Account from '../../src/models/Account.js';
import Strategy from '../../src/models/Strategy.js';
import Playbook from '../../src/models/Playbook.js';
import ImportJob from '../../src/models/ImportJob.js';
import JournalEntry from '../../src/models/JournalEntry.js';
import AppSettings from '../../src/models/AppSettings.js';
import {
  bulkEditTrades,
  getTradeById,
  listTrades,
} from '../../src/services/tradeService.js';
import {
  searchWorkspace,
  getPreferences,
  savePreferences,
} from '../../src/controllers/workspaceController.js';
import {
  listImportJobs,
  getImportResults,
} from '../../src/controllers/importController.js';
import asyncHandler from '../../src/middleware/asyncHandler.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

test(
  'workspace operations preserve ownership and financial data on real MongoDB',
  { timeout: 30000 },
  async (t) => {
    const name = `tortoise-workspace-test-${process.pid}-${Date.now()}`;
    await mongoose.connect(`mongodb://127.0.0.1:27017/${name}`);
    try {
      const a = new mongoose.Types.ObjectId(),
        b = new mongoose.Types.ObjectId();
      const accounts = await Account.create([
        { userId: a, name: 'A owned', broker: 'generic' },
        { userId: b, name: 'B private', broker: 'generic' },
      ]);
      const strategy = await Strategy.create({
          userId: a,
          name: 'Needle strategy',
        }),
        foreign = await Strategy.create({ userId: b, name: 'Needle private' });
      const playbook = await Playbook.create({
        userId: a,
        setupName: 'Needle playbook',
      });
      const make = (userId, accountId) => ({
        userId,
        accountId,
        symbol: 'NEEDLE',
        entryTime: new Date('2026-01-01T10:00:00Z'),
        exitTime: new Date('2026-01-01T11:00:00Z'),
        direction: 'long',
        quantity: 1,
        entryPrice: 100,
        exitPrice: 90,
        netPnL: -10,
        grossPnL: -10,
        rMultiple: -1,
        notes: 'Needle note',
        followedPlan: false,
      });
      const trades = await Trade.create([
        {
          ...make(a, accounts[0]._id),
          strategy: strategy._id,
          playbook: playbook._id,
        },
        make(b, accounts[1]._id),
      ]);
      await JournalEntry.create([
        {
          userId: a,
          type: 'daily',
          date: new Date(),
          title: 'Needle Scroll',
          content: 'owned',
        },
        {
          userId: b,
          type: 'daily',
          date: new Date(),
          title: 'Needle private',
          content: 'SECRET',
        },
      ]);
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = { id: String(a) };
        next();
      });
      app.get('/reports/:category', asyncHandler(getReport));
      app.get('/search', asyncHandler(searchWorkspace));
      app.get('/preferences', asyncHandler(getPreferences));
      app.put('/preferences', asyncHandler(savePreferences));
      app.get('/jobs', asyncHandler(listImportJobs));
      app.get('/jobs/:id/results', asyncHandler(getImportResults));
      app.use(errorHandler);
      await t.test(
        'labels resolve only owned references without replacing ID fields',
        async () => {
          const trade = await getTradeById(trades[0]._id, String(a));
          assert.deepEqual(trade.labels, {
            account: 'A owned',
            strategy: 'Needle strategy',
            playbook: 'Needle playbook',
          });
          assert.equal(String(trade.strategy), String(strategy._id));
          assert.equal(await getTradeById(trades[1]._id, String(a)), null);
          await Trade.updateOne(
            { _id: trades[0]._id },
            { $set: { strategy: foreign._id } }
          );
          assert.equal(
            (await getTradeById(trades[0]._id, String(a))).labels.strategy,
            null
          );
          await Trade.updateOne(
            { _id: trades[0]._id },
            { $set: { strategy: strategy._id } }
          );
        }
      );
      await t.test(
        'bulk changes are bounded, preserve financials, reject mixed ownership before any write',
        async () => {
          await assert.rejects(
            bulkEditTrades(
              {
                ids: trades.map((v) => String(v._id)),
                changes: { setup: 'bad' },
              },
              String(a)
            ),
            (e) => e.statusCode === 404
          );
          assert.equal((await Trade.findById(trades[0]._id)).setup, '');
          await assert.rejects(
            bulkEditTrades(
              {
                ids: [String(trades[0]._id)],
                changes: { strategy: String(foreign._id) },
              },
              String(a)
            ),
            (e) => e.statusCode === 404
          );
          const result = await bulkEditTrades(
            {
              ids: [String(trades[0]._id)],
              changes: {
                setup: 'H2',
                tags: ['review'],
                session: 'open',
                followedPlan: false,
                mistake: ['early'],
              },
            },
            String(a)
          );
          assert.equal(result.modifiedCount, 1);
          const after = await Trade.findById(trades[0]._id);
          assert.equal(after.netPnL, -10);
          assert.equal(after.rMultiple, -1);
          assert.equal(after.notes, 'Needle note');
          assert.equal((await Trade.findById(trades[1]._id)).setup, '');
          const report = await request(app)
            .get('/reports/performance?followedPlan=false&outcome=loss')
            .expect(200);
          assert.equal(report.body.summary.netPnL, -10);
          const emptyReport = await request(app)
            .get('/reports/performance?followedPlan=true')
            .expect(200);
          assert.equal(emptyReport.body.summary.totalTrades, 0);

          assert.equal(
            (
              await listTrades(String(a), {
                followedPlan: 'false',
                outcome: 'loss',
              })
            ).pagination.total,
            1
          );
        }
      );
      await t.test(
        'search scopes every collection and symbols, escapes input and caps per group',
        async () => {
          await request(app).get('/search?q=x').expect(400);
          const res = await request(app)
            .get('/search?q=Needle&userId=' + b)
            .expect(200);
          assert.equal(JSON.stringify(res.body).includes('SECRET'), false);
          assert.equal(JSON.stringify(res.body).includes('private'), false);
          assert.equal(
            res.body.groups.find((v) => v.type === 'trade').items.length,
            1
          );
          assert.equal(
            res.body.groups.find((v) => v.type === 'symbol').items[0].label,
            'NEEDLE'
          );
          const tagSearch = await request(app)
            .get('/search?q=review')
            .expect(200);
          assert.equal(
            tagSearch.body.groups.find((g) => g.type === 'tag').items[0].label,
            'review'
          );
          await Strategy.insertMany(
            Array.from({ length: 12 }, (_, i) => ({
              userId: a,
              name: `Needle cap ${i}`,
            }))
          );
          const capped = await request(app).get('/search?q=Needle').expect(200);
          assert.equal(
            capped.body.groups.find((g) => g.type === 'strategy').items.length,
            10
          );
          assert.equal(
            capped.body.groups.find((g) => g.type === 'strategy').hasMore,
            true
          );
          const literal = await request(app).get('/search?q=.*').expect(200);
          assert.ok(literal.body.groups.every((g) => !g.items.length));
        }
      );
      await t.test(
        'preferences are per user and reject foreign reference IDs',
        async () => {
          await AppSettings.create({
            userId: b,
            workspace: { savedFilters: [{ name: 'SECRET' }] },
          });
          const saved = [
            {
              id: 'c8904dd5-c858-41d4-868c-78335f8c31c9',
              name: 'Plan violations',
              filters: { followedPlan: 'false' },
            },
          ];
          await request(app)
            .put('/preferences')
            .send({ savedFilters: saved })
            .expect(200);
          const res = await request(app).get('/preferences').expect(200);
          assert.equal(res.body.savedFilters[0].name, 'Plan violations');
          await request(app)
            .put('/preferences')
            .send({
              tradeLayout: {
                columns: ['symbol', 'entryTime'],
                density: 'comfortable',
                sortBy: 'symbol',
                sortDir: 'asc',
                filters: { tags: ['review'] },
              },
            })
            .expect(200);
          const persisted = await request(app).get('/preferences').expect(200);
          assert.equal(persisted.body.savedFilters[0].name, 'Plan violations');
          assert.deepEqual(persisted.body.tradeLayout.columns, [
            'symbol',
            'entryTime',
          ]);

          await request(app)
            .put('/preferences')
            .send({
              savedFilters: [
                {
                  ...saved[0],
                  filters: { accountId: String(accounts[1]._id) },
                },
              ],
            })
            .expect(404);
          await request(app)
            .put('/preferences')
            .send({ userId: String(b) })
            .expect(400);
          assert.equal(
            (await AppSettings.findOne({ userId: b })).workspace.savedFilters[0]
              .name,
            'SECRET'
          );
        }
      );
      await t.test(
        'import summaries omit rows; paginated details remain private and duplicates preserve trades',
        async () => {
          const jobs = await ImportJob.create([
            {
              userId: a,
              accountId: accounts[0]._id,
              originalFilename: 'owned.csv',
              rows: Array.from({ length: 105 }, (_, i) => ({
                rowNumber: i + 1,
                outcome: 'duplicate',
                tradeId: trades[0]._id,
                message: 'Skipped',
              })),
            },
            {
              userId: b,
              accountId: accounts[1]._id,
              originalFilename: 'SECRET.csv',
            },
          ]);
          const res = await request(app).get('/jobs?summary=true').expect(200);
          assert.equal(res.body.length, 1);
          assert.equal(res.body[0].rows, undefined);
          assert.equal(res.body[0].accountName, 'A owned');
          const first = await request(app)
            .get(`/jobs/${jobs[0]._id}/results`)
            .expect(200);
          assert.equal(first.body.rows.length, 100);
          assert.equal(first.body.hasMore, true);
          const second = await request(app)
            .get(`/jobs/${jobs[0]._id}/results?page=2`)
            .expect(200);
          assert.equal(second.body.rows.length, 5);
          await request(app).get(`/jobs/${jobs[1]._id}/results`).expect(404);
          assert.equal(
            (await Trade.findById(trades[0]._id)).notes,
            'Needle note'
          );
        }
      );
    } finally {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
