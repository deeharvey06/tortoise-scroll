import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import accountRoutes from '../src/routes/accountRoutes.js';
import Account from '../src/models/Account.js';
import AppSettings from '../src/models/AppSettings.js';
import Trade from '../src/models/Trade.js';
import ImportJob from '../src/models/ImportJob.js';
import BrokerExecution from '../src/models/BrokerExecution.js';
import BrokerConnection from '../src/models/BrokerConnection.js';
import JournalEntry from '../src/models/JournalEntry.js';
import RiskSettings from '../src/models/RiskSettings.js';

const owner = new mongoose.Types.ObjectId();
const foreignOwner = new mongoose.Types.ObjectId();
const originals = new Map();
function stub(obj, key, value) {
  const token = `${obj.modelName || 'obj'}:${key}`;
  if (!originals.has(token)) originals.set(token, [obj, key, obj[key]]);
  obj[key] = value;
}
afterEach(() => {
  for (const [, [obj, key, value]] of originals) obj[key] = value;
  originals.clear();
});
function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.user = { id: owner };
    next();
  });
  instance.use('/accounts', accountRoutes);
  instance.use((err, _req, res, _next) =>
    res
      .status(res.statusCode >= 400 ? res.statusCode : err.statusCode || 500)
      .json({ error: { message: err.message } })
  );
  return instance;
}
function leanQuery(value) {
  return { lean: async () => value };
}

test('missing accounts deny performance, history, update, and deletion', async () => {
  stub(Account, 'findOne', () => leanQuery(null));
  stub(Account, 'exists', async () => null);
  stub(Account, 'findOneAndUpdate', async () => null);
  const id = new mongoose.Types.ObjectId();
  assert.equal(
    (await request(app()).get(`/accounts/${id}/performance`)).status,
    404
  );
  assert.equal(
    (await request(app()).get(`/accounts/${id}/import-history`)).status,
    404
  );
  assert.equal(
    (await request(app()).put(`/accounts/${id}`).send({ name: 'Missing' }))
      .status,
    404
  );
  assert.equal((await request(app()).delete(`/accounts/${id}`)).status, 404);
});

test('an account without trades returns zero performance and its starting balance', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'findOne', () => leanQuery({ _id: id, startingBalance: 5000 }));
  stub(Trade, 'find', () => ({ select: () => leanQuery([]) }));
  const response = await request(app()).get(`/accounts/${id}/performance`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    tradeCount: 0,
    closedTradeCount: 0,
    netPnL: 0,
    winRate: 0,
    totalR: 0,
    currentBalance: 5000,
  });
});

test('account list is always scoped to the authenticated owner', async () => {
  let captured;
  stub(Account, 'find', (filter) => {
    captured = filter;
    return {
      sort() {
        return { lean: async () => [] };
      },
    };
  });
  stub(AppSettings, 'findOne', () => leanQuery(null));
  const response = await request(app()).get('/accounts');
  assert.equal(response.status, 200);
  assert.equal(String(captured.userId), String(owner));
});

test('active account list adds active ownership filter', async () => {
  let captured;
  stub(Account, 'find', (filter) => {
    captured = filter;
    return {
      sort() {
        return { lean: async () => [] };
      },
    };
  });
  stub(AppSettings, 'findOne', () => leanQuery(null));
  const response = await request(app()).get('/accounts?active=true');
  assert.equal(response.status, 200);
  assert.equal(String(captured.userId), String(owner));
  assert.equal(captured.isActive, true);
});

test('client-supplied userId is ignored when creating an account', async () => {
  let created;
  stub(Account, 'create', async (payload) => {
    created = payload;
    return {
      ...payload,
      _id: new mongoose.Types.ObjectId(),
      toObject() {
        return { ...this };
      },
    };
  });
  const response = await request(app())
    .post('/accounts')
    .send({ name: 'Main', userId: foreignOwner });
  assert.equal(response.status, 201);
  assert.equal(String(created.userId), String(owner));
  assert.notEqual(String(created.userId), String(foreignOwner));
});

test('cross-user account ID lookup produces not found because ownership is part of the query', async () => {
  let captured;
  stub(Account, 'findOne', (filter) => {
    captured = filter;
    return leanQuery(null);
  });
  stub(AppSettings, 'findOne', () => leanQuery(null));
  const response = await request(app()).get(
    `/accounts/${new mongoose.Types.ObjectId()}`
  );
  assert.equal(response.status, 404);
  assert.equal(String(captured.userId), String(owner));
});

test('setting a default account first verifies the account belongs to the authenticated user', async () => {
  let captured;
  stub(Account, 'findOne', async (filter) => {
    captured = filter;
    return { _id: filter._id, userId: owner, isActive: true };
  });
  stub(AppSettings, 'findOneAndUpdate', async () => ({}));
  const id = new mongoose.Types.ObjectId();
  const response = await request(app()).post(`/accounts/${id}/default`);
  assert.equal(response.status, 200);
  assert.equal(String(captured.userId), String(owner));
  assert.equal(captured.isActive, true);
});

test('deleting an account with dependent records is rejected and recommends archiving', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'findOne', (filter) => {
    assert.equal(String(filter.userId), String(owner));
    return leanQuery({ _id: id, userId: owner, name: 'Main' });
  });
  stub(Trade, 'countDocuments', async (filter) => {
    assert.equal(String(filter.userId), String(owner));
    return 3;
  });
  for (const Model of [
    ImportJob,
    BrokerExecution,
    BrokerConnection,
    JournalEntry,
    RiskSettings,
  ]) {
    stub(Model, 'countDocuments', async (filter) => {
      assert.equal(String(filter.userId), String(owner));
      return 0;
    });
  }
  const response = await request(app()).delete(`/accounts/${id}`);
  assert.equal(response.status, 409);
  assert.match(response.body.error.message, /Archive it instead/i);
});

test('account update remains owner-scoped and ignores ownership fields', async () => {
  const id = new mongoose.Types.ObjectId();
  let capturedFilter;
  let capturedUpdate;
  stub(Account, 'findOneAndUpdate', async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: id, userId: owner, name: update.name, isActive: true };
  });
  const response = await request(app())
    .put(`/accounts/${id}`)
    .send({ name: 'Renamed', userId: foreignOwner, isActive: false });
  assert.equal(response.status, 200);
  assert.equal(String(capturedFilter.userId), String(owner));
  assert.equal(capturedUpdate.name, 'Renamed');
  assert.equal(capturedUpdate.userId, undefined);
  assert.equal(
    capturedUpdate.isActive,
    undefined,
    'generic update must not bypass archive/restore workflow'
  );
});

test('archiving an owned account marks it inactive and clears it as default', async () => {
  const id = new mongoose.Types.ObjectId();
  let capturedFilter;
  let capturedUpdate;
  let settingsFilter;
  stub(Account, 'findOneAndUpdate', async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return {
      _id: id,
      userId: owner,
      isActive: false,
      archivedAt: update.archivedAt,
    };
  });
  stub(AppSettings, 'updateOne', async (filter) => {
    settingsFilter = filter;
    return {};
  });
  const response = await request(app()).post(`/accounts/${id}/archive`);
  assert.equal(response.status, 200);
  assert.equal(String(capturedFilter.userId), String(owner));
  assert.equal(capturedUpdate.isActive, false);
  assert.ok(capturedUpdate.archivedAt instanceof Date);
  assert.equal(String(settingsFilter.userId), String(owner));
  assert.equal(String(settingsFilter.defaultAccountId), String(id));
});

test('restoring an archived account is owner-scoped and reactivates it', async () => {
  const id = new mongoose.Types.ObjectId();
  let capturedFilter;
  let capturedUpdate;
  stub(Account, 'findOneAndUpdate', async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { _id: id, userId: owner, isActive: true, archivedAt: null };
  });
  const response = await request(app()).post(`/accounts/${id}/restore`);
  assert.equal(response.status, 200);
  assert.equal(String(capturedFilter.userId), String(owner));
  assert.equal(capturedUpdate.isActive, true);
  assert.equal(capturedUpdate.archivedAt, null);
});

test('inactive account cannot be selected as default', async () => {
  const id = new mongoose.Types.ObjectId();
  let captured;
  stub(Account, 'findOne', async (filter) => {
    captured = filter;
    return null;
  });
  const response = await request(app()).post(`/accounts/${id}/default`);
  assert.equal(response.status, 404);
  assert.equal(String(captured.userId), String(owner));
  assert.equal(captured.isActive, true);
});

test('account performance returns deterministic balance, win rate, and R for owned trades', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'findOne', () =>
    leanQuery({ _id: id, userId: owner, startingBalance: 10000 })
  );
  stub(Trade, 'find', (filter) => {
    assert.equal(String(filter.userId), String(owner));
    return {
      select() {
        return {
          lean: async () => [
            { netPnL: 200, rMultiple: 2 },
            { netPnL: -100, rMultiple: -1 },
            { netPnL: null, rMultiple: null },
          ],
        };
      },
    };
  });
  const response = await request(app()).get(`/accounts/${id}/performance`);
  assert.equal(response.status, 200);
  assert.equal(response.body.tradeCount, 3);
  assert.equal(response.body.closedTradeCount, 2);
  assert.equal(response.body.netPnL, 100);
  assert.equal(response.body.winRate, 50);
  assert.equal(response.body.totalR, 1);
  assert.equal(response.body.currentBalance, 10100);
});

test('account import history verifies ownership before returning jobs', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'exists', async (filter) => {
    assert.equal(String(filter.userId), String(owner));
    return { _id: id };
  });
  stub(ImportJob, 'find', (filter) => {
    assert.equal(String(filter.userId), String(owner));
    assert.equal(String(filter.accountId), String(id));
    return {
      sort() {
        return {
          limit() {
            return { lean: async () => [{ _id: 'job-1' }] };
          },
        };
      },
    };
  });
  const response = await request(app()).get(`/accounts/${id}/import-history`);
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
});

test('missing account name and invalid account timezone are rejected', async () => {
  let response = await request(app())
    .post('/accounts')
    .send({ broker: 'Schwab' });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /name is required/i);
  response = await request(app())
    .post('/accounts')
    .send({ name: 'Bad TZ', tradingConfig: { timezone: 'Not/AZone' } });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /IANA time zone/i);
});

test('an unreferenced owned account can be permanently deleted', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'findOne', () => leanQuery({ _id: id, userId: owner }));
  for (const Model of [
    Trade,
    ImportJob,
    BrokerExecution,
    BrokerConnection,
    JournalEntry,
    RiskSettings,
  ]) {
    stub(Model, 'countDocuments', async () => 0);
  }
  let deletedFilter;
  stub(Account, 'deleteOne', async (filter) => {
    deletedFilter = filter;
    return { deletedCount: 1 };
  });
  stub(AppSettings, 'updateOne', async () => ({}));
  const response = await request(app()).delete(`/accounts/${id}`);
  assert.equal(response.status, 204);
  assert.equal(String(deletedFilter.userId), String(owner));
});

test('archiving or restoring an unknown/foreign account returns not found', async () => {
  stub(Account, 'findOneAndUpdate', async () => null);
  let response = await request(app()).post(
    `/accounts/${new mongoose.Types.ObjectId()}/archive`
  );
  assert.equal(response.status, 404);
  response = await request(app()).post(
    `/accounts/${new mongoose.Types.ObjectId()}/restore`
  );
  assert.equal(response.status, 404);
});

test('invalid starting balance is rejected before account persistence', async () => {
  const response = await request(app())
    .post('/accounts')
    .send({ name: 'Bad Balance', startingBalance: 'not-a-number' });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /startingBalance/i);
});

test('a newly-created inactive account cannot be made default', async () => {
  stub(Account, 'create', async (payload) => ({
    ...payload,
    _id: new mongoose.Types.ObjectId(),
    isActive: false,
    toObject() {
      return { ...this };
    },
  }));
  const response = await request(app())
    .post('/accounts')
    .send({ name: 'Inactive', isDefault: true });
  assert.equal(response.status, 409);
  assert.match(
    response.body.error.message,
    /Inactive accounts cannot be the default/i
  );
});

test('editing default state can set and clear the owned default account', async () => {
  const id = new mongoose.Types.ObjectId();
  stub(Account, 'findOneAndUpdate', async (_filter, update) => ({
    _id: id,
    userId: owner,
    isActive: true,
    ...update,
  }));
  let setCalls = 0;
  let clearCalls = 0;
  stub(AppSettings, 'findOneAndUpdate', async () => {
    setCalls++;
    return {};
  });
  stub(AppSettings, 'updateOne', async () => {
    clearCalls++;
    return {};
  });
  let response = await request(app())
    .put(`/accounts/${id}`)
    .send({ name: 'Main', isDefault: true });
  assert.equal(response.status, 200);
  assert.equal(setCalls, 1);
  response = await request(app())
    .put(`/accounts/${id}`)
    .send({ name: 'Main', isDefault: false });
  assert.equal(response.status, 200);
  assert.equal(clearCalls, 1);
});
