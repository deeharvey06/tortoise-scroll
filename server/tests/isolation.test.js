import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Trade from '../src/models/Trade.js';
import Account from '../src/models/Account.js';
import JournalEntry from '../src/models/JournalEntry.js';
import Strategy from '../src/models/Strategy.js';
import Playbook from '../src/models/Playbook.js';
import Tag from '../src/models/Tag.js';
import TaggingRule from '../src/models/TaggingRule.js';
import ImportJob from '../src/models/ImportJob.js';
import RiskSettings from '../src/models/RiskSettings.js';
import BacktestConfig from '../src/models/BacktestConfig.js';
import AIConversation from '../src/models/AIConversation.js';
import AIMemory from '../src/models/AIMemory.js';
import AISettings from '../src/models/AISettings.js';
import AppSettings from '../src/models/AppSettings.js';
import * as tradeService from '../src/services/tradeService.js';
import { getEntry } from '../src/controllers/journalController.js';
import { updateStrategy } from '../src/controllers/strategyController.js';
import { getConversation } from '../src/controllers/aiController.js';
import { getImportJob } from '../src/controllers/importController.js';
import { buildTradeQuery } from '../src/services/tradeService.js';
import { ownedPayload } from '../src/utils/ownership.js';
import { jobQueue } from '../src/queue/jobQueue.js';
import { validateBackupRelationships } from '../src/controllers/backupController.js';
import * as autoTaggerAgent from '../src/agents/autoTaggerAgent.js';

const ownerA = new mongoose.Types.ObjectId();
const ownerB = new mongoose.Types.ObjectId();
const resourceId = new mongoose.Types.ObjectId();
const originals = new Map();
function replace(object, key, value) {
  originals.set(`${object.modelName || 'object'}:${key}`, [
    object,
    key,
    object[key],
  ]);
  object[key] = value;
}
after(() => {
  for (const [, [object, key, value]] of originals) object[key] = value;
});
const emptyQuery = (capture, filter) => {
  capture.push(filter);
  return {
    lean: async () => null,
    then: (resolve) => Promise.resolve(null).then(resolve),
  };
};
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json() {},
  send() {},
});

test('every user-owned model requires userId', () => {
  for (const Model of [
    Account,
    Trade,
    JournalEntry,
    Strategy,
    Playbook,
    Tag,
    TaggingRule,
    ImportJob,
    RiskSettings,
    BacktestConfig,
    AIConversation,
    AIMemory,
    AISettings,
    AppSettings,
  ]) {
    assert.equal(
      Model.schema.path('userId')?.options.required,
      true,
      `${Model.modelName} must require userId`,
    );
  }
});

test('client-supplied userId is never trusted on creation', () => {
  assert.equal(
    String(
      ownedPayload({ user: { id: ownerB } }, { name: 'x', userId: ownerA })
        .userId,
    ),
    String(ownerB),
  );
  assert.equal(
    buildTradeQuery({ userId: ownerB, symbol: 'aapl' }).userId,
    ownerB,
  );
});

test('User B cannot read, edit, or delete User A trade', async () => {
  const filters = [];
  replace(Trade, 'findOne', (filter) => emptyQuery(filters, filter));
  replace(Trade, 'findOneAndDelete', async (filter) => {
    filters.push(filter);
    return null;
  });
  assert.equal(await tradeService.getTradeById(resourceId, ownerB), null);
  assert.equal(
    await tradeService.updateTrade(resourceId, { notes: 'attack' }, ownerB),
    null,
  );
  assert.equal(await tradeService.deleteTrade(resourceId, ownerB), null);
  assert.equal(filters.length, 3);
  for (const filter of filters)
    assert.equal(String(filter.userId), String(ownerB));
});

test('User B cannot approve an agent suggestion for User A trade', async () => {
  const originalFindOne = Trade.findOne;
  Trade.findOne = (filter) => emptyQuery([], filter);
  try {
    await assert.rejects(
      () => autoTaggerAgent.approveSuggestion(resourceId, ['foreign'], ownerB),
      (error) =>
        error.statusCode === 404 && /Trade not found/.test(error.message),
    );
  } finally {
    Trade.findOne = originalFindOne;
  }
});

test('User B cannot read User A journal entry', async () => {
  const filters = [];
  replace(JournalEntry, 'findOne', (filter) => emptyQuery(filters, filter));
  const res = response();
  await assert.rejects(
    () => getEntry({ params: { id: resourceId }, user: { id: ownerB } }, res),
    /not found/i,
  );
  assert.equal(String(filters[0].userId), String(ownerB));
  assert.equal(res.statusCode, 404);
});

test('User B cannot modify User A strategy', async () => {
  let filter;
  replace(Strategy, 'findOneAndUpdate', async (value) => {
    filter = value;
    return null;
  });
  const res = response();
  await assert.rejects(
    () =>
      updateStrategy(
        {
          params: { id: resourceId },
          body: { name: 'stolen', userId: ownerA },
          user: { id: ownerB },
        },
        res,
      ),
    /not found/i,
  );
  assert.equal(String(filter.userId), String(ownerB));
  assert.equal(res.statusCode, 404);
});

test('User B cannot access User A AI conversation', async () => {
  const filters = [];
  replace(AIConversation, 'findOne', (filter) => emptyQuery(filters, filter));
  const res = response();
  await assert.rejects(
    () =>
      getConversation(
        { params: { id: resourceId }, user: { id: ownerB } },
        res,
      ),
    /not found/i,
  );
  assert.equal(String(filters[0].userId), String(ownerB));
  assert.equal(res.statusCode, 404);
});

test('User B cannot access User A import job', async () => {
  const filters = [];
  replace(ImportJob, 'findOne', (filter) => emptyQuery(filters, filter));
  const res = response();
  await assert.rejects(
    () =>
      getImportJob({ params: { id: resourceId }, user: { id: ownerB } }, res),
    /not found/i,
  );
  assert.equal(String(filters[0].userId), String(ownerB));
  assert.equal(res.statusCode, 404);
});

test('in-memory job status is isolated by owner', async () => {
  jobQueue.register('isolation-test', async () => 'done');
  const jobId = await jobQueue.enqueue('isolation-test', {}, ownerA);
  assert.equal(jobQueue.getJobStatus(jobId, ownerB), null);
  assert.ok(jobQueue.getJobStatus(jobId, ownerA));
  assert.equal(jobQueue.getQueueStats(ownerB).total, 0);
});

test('crafted backup cannot reference another user resource', async () => {
  const models = [
    Account,
    Strategy,
    Playbook,
    Trade,
    ImportJob,
    AIConversation,
  ];
  const saved = models.map((Model) => [Model, Model.find]);
  for (const Model of models) {
    Model.find = () => ({
      select() {
        return this;
      },
      lean: async () => [],
    });
  }
  try {
    await assert.rejects(
      () =>
        validateBackupRelationships(
          { data: { trades: [{ _id: resourceId, accountId: ownerA }] } },
          ownerB,
        ),
      /Invalid backup relationship: trades.*accountId/,
    );
  } finally {
    for (const [Model, find] of saved) Model.find = find;
  }
});
