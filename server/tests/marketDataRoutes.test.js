import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import session from 'express-session';
import request from 'supertest';
import { createMarketDataService } from '../src/services/marketDataService.js';
import {
  fixture,
  requestRange,
  OWNER,
  OTHER,
} from './fixtures/market-data/helpers.js';
import User from '../src/models/User.js';
import SessionRecord from '../src/models/SessionRecord.js';
import Trade from '../src/models/Trade.js';
import BacktestConfig from '../src/models/BacktestConfig.js';
import InstrumentSpecification from '../src/models/InstrumentSpecification.js';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET =
  'phase-four-test-session-secret-at-least-32-characters';
process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:5174';
let createApp;
const users = new Map();
const originals = [];
function stub(object, key, value) {
  originals.push([object, key, object[key]]);
  object[key] = value;
}

before(async () => {
  ({ createApp } = await import('../src/app.js'));
  stub(User, 'findById', (id) => ({
    select: async () => users.get(String(id)) || null,
  }));
  stub(SessionRecord, 'findOneAndUpdate', async () => ({}));
  stub(SessionRecord, 'deleteOne', async () => ({}));
});

after(() => {
  for (const [object, key, original] of originals.reverse())
    object[key] = original;
});

async function cookie(store, userId = OWNER, role = 'USER', status = 'ACTIVE') {
  const id = crypto.randomUUID();
  users.set(userId, { _id: userId, role, status, sessionVersion: 0 });
  await new Promise((resolve, reject) =>
    store.set(
      id,
      {
        userId,
        sessionVersion: 0,
        cookie: {
          originalMaxAge: 60_000,
          expires: new Date(Date.now() + 60_000),
        },
      },
      (error) => (error ? reject(error) : resolve())
    )
  );

  const signed = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(id)
    .digest('base64')
    .replace(/=+$/, '');

  return `tortoise.sid=${encodeURIComponent(`s:${id}.${signed}`)}`;
}

async function setup(t) {
  const local = await fixture(t);
  const store = new session.MemoryStore();
  const service = createMarketDataService({ provider: local.provider });
  const app = createApp({
    sessionStore: store,
    enforceCsrf: true,
    marketDataService: service,
  });
  return { ...local, app, store };
}

const params = {
  symbol: requestRange.symbol,
  timeframe: requestRange.timeframe,
  from: requestRange.from,
  to: requestRange.to,
};

test('all new market-data routes enforce real session authentication', async (t) => {
  const { app } = await setup(t);
  for (const route of ['status', 'datasets', 'candles']) {
    const response = await request(app)
      .get(`/api/market-data/${route}`)
      .query(params);
    assert.equal(response.status, 401);
  }
});

test('owned catalog and candle API serialize canonical data and preserve trusted ownership', async (t) => {
  const { app, store, root } = await setup(t);
  const auth = await cookie(store);
  const status = await request(app)
    .get('/api/market-data/status')
    .set('Cookie', auth);

  assert.deepEqual(status.body, {
    configured: true,
    provider: 'local-csv',
    state: 'configured',
  });

  const catalog = await request(app)
    .get('/api/market-data/datasets')
    .set('Cookie', auth);

  assert.equal(catalog.body.datasets.length, 1);
  assert.ok(!JSON.stringify(catalog.body).includes(root));

  const response = await request(app)
    .get('/api/market-data/candles')
    .query({ ...params, userId: OTHER })
    .set('Cookie', auth);

  assert.equal(response.status, 200);
  assert.equal(response.body.candles.length, 3);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.candles[0].symbol, 'AAPL');
  assert.equal(response.body.candles[0].timestamp, '2026-03-09T13:30:00.000Z');
});

for (const role of ['USER', 'ADMIN', 'ROOT']) {
  test(`${role} cannot select a different owner's files or cached candles`, async (t) => {
    const { app, store } = await setup(t);

    await request(app)
      .get('/api/market-data/candles')
      .query(params)
      .set('Cookie', await cookie(store));

    const auth = await cookie(store, OTHER, role);
    const catalog = await request(app)
      .get('/api/market-data/datasets')
      .query({ userId: OWNER })
      .set('Cookie', auth);

    assert.deepEqual(catalog.body.datasets, []);
    const denied = await request(app)
      .get('/api/market-data/candles')
      .query({
        ...params,
        userId: OWNER,
        datasetId: 'aapl-minute',
        file: '../candles.csv',
      })
      .set('Cookie', auth);

    assert.equal(denied.status, 404);
    assert.equal(denied.body.error.code, 'MARKET_DATA_UNAVAILABLE');
  });
}

test('suspended and stale sessions stay denied; new routes do not bypass CSRF', async (t) => {
  const { app, store } = await setup(t);
  const suspended = await cookie(store, OWNER, 'USER', 'SUSPENDED');
  assert.equal(
    (await request(app).get('/api/market-data/status').set('Cookie', suspended))
      .status,
    403
  );

  const stale = await cookie(store);
  users.get(OWNER).sessionVersion = 1;
  assert.equal(
    (await request(app).get('/api/market-data/status').set('Cookie', stale))
      .status,
    401
  );

  assert.equal(
    (await request(app).post('/api/market-data/candles')).status,
    403
  );
});

test('API returns safe machine-readable validation errors', async (t) => {
  const { app, store } = await setup(t);

  const auth = await cookie(store);
  const bad = await request(app)
    .get('/api/market-data/candles')
    .query({ ...params, timeframe: '7m' })
    .set('Cookie', auth);

  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'MARKET_DATA_UNSUPPORTED_TIMEFRAME');
  assert.equal(bad.body.error.stack, undefined);

  const outside = await request(app)
    .get('/api/market-data/candles')
    .query({ ...params, to: '2026-03-10T00:00:00Z' })
    .set('Cookie', auth);

  assert.equal(outside.status, 422);
  assert.ok(outside.body.error.details.coverage);
});

test('Replay never accepts a client userId when building its trade query', async (t) => {
  const { app, store } = await setup(t);
  let filter;

  stub(Trade, 'find', (query) => {
    filter = query;
    return { sort: () => ({ lean: async () => [] }) };
  });

  const response = await request(app)
    .get('/api/replay/session')
    .query({ date: '2026-03-09', userId: OTHER })
    .set('Cookie', await cookie(store));

  assert.equal(response.status, 200);
  assert.equal(String(filter.userId), OWNER);
});

test('existing Backtesting consumes owner-scoped real CSV bars and refuses missing data or foreign configs', async (t) => {
  const { app, store, root } = await setup(t);
  const previous = [
    process.env.MARKET_DATA_PROVIDER,
    process.env.MARKET_DATA_LOCAL_ROOT,
  ];

  process.env.MARKET_DATA_PROVIDER = 'local-csv';
  process.env.MARKET_DATA_LOCAL_ROOT = root;

  t.after(() => {
    for (const [key, value] of [
      ['MARKET_DATA_PROVIDER', previous[0]],
      ['MARKET_DATA_LOCAL_ROOT', previous[1]],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  let saved = 0;
  const config = {
    symbol: 'AAPL',
    timeframe: '1m',
    dateFrom: new Date(params.from),
    dateTo: new Date(params.to),
    direction: 'long',
    entryRule: { type: 'smaCrossover', fastPeriod: 1, slowPeriod: 2 },
    positionSize: 1,
    save: async () => {
      saved++;
    },
  };

  stub(BacktestConfig, 'findOne', async (query) =>
    String(query.userId) === OWNER ? config : null
  );

  stub(InstrumentSpecification, 'findOne', () => ({ lean: async () => null }));

  const auth = await cookie(store);
  const endpoint = `/api/backtest/configs/${OWNER}/run`;
  const response = await request(app)
    .post(endpoint)
    .set('Cookie', auth)
    .set('X-CSRF-Protection', '1');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.trades));
  assert.equal(saved, 1);

  stub(InstrumentSpecification, 'findOne', () => ({
    lean: async () => ({ contractMultiplier: 50, source: 'user' }),
  }));

  const unsupported = await request(app)
    .post(endpoint)
    .set('Cookie', auth)
    .set('X-CSRF-Protection', '1');

  assert.equal(unsupported.status, 422);
  assert.match(unsupported.body.error.message, /contract multiplier of 1/);
  assert.equal(saved, 1);

  stub(InstrumentSpecification, 'findOne', () => ({ lean: async () => null }));
  config.dateTo = new Date('2026-03-10T00:00:00Z');
  const incomplete = await request(app)
    .post(endpoint)
    .set('Cookie', auth)
    .set('X-CSRF-Protection', '1');

  assert.equal(incomplete.status, 422);
  assert.equal(saved, 1);

  const denied = await request(app)
    .post(endpoint)
    .set('Cookie', await cookie(store, OTHER))
    .set('X-CSRF-Protection', '1');

  assert.equal(denied.status, 404);
});

test('versioned Backtesting executes owned real candles and protects result writes from foreign users and edits', async (t) => {
  const { strategy, execution } =
    await import('./fixtures/backtest/helpers.js');
  const { app, store, root } = await setup(t);
  const previous = [
    process.env.MARKET_DATA_PROVIDER,
    process.env.MARKET_DATA_LOCAL_ROOT,
  ];
  process.env.MARKET_DATA_PROVIDER = 'local-csv';
  process.env.MARKET_DATA_LOCAL_ROOT = root;
  t.after(() => {
    for (const [key, value] of [
      ['MARKET_DATA_PROVIDER', previous[0]],
      ['MARKET_DATA_LOCAL_ROOT', previous[1]],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const config = {
    _id: OWNER,
    __v: 0,
    engineVersion: 2,
    datasetId: 'aapl-minute',
    symbol: 'AAPL',
    timeframe: '1m',
    dateFrom: new Date(params.from),
    dateTo: new Date(params.to),
    strategyDefinition: strategy,
    execution,
  };
  stub(InstrumentSpecification, 'findOne', () => ({
    lean: async () => ({
      tickSize: 0.01,
      contractMultiplier: 1,
      currency: 'USD',
      source: 'user',
    }),
  }));
  stub(BacktestConfig, 'findOne', async (query) =>
    String(query.userId) === OWNER ? config : null
  );
  let writes = 0;
  stub(BacktestConfig, 'findOneAndUpdate', async (query, update) => {
    assert.equal(String(query.userId), OWNER);
    assert.equal(query.__v, 0);
    assert.equal(update.$set.lastResult.engineVersion, 2);
    writes++;
    return config;
  });
  const auth = await cookie(store);
  const endpoint = `/api/backtest/configs/${OWNER}/run`;
  const run = () =>
    request(app)
      .post(endpoint)
      .set('Cookie', auth)
      .set('X-CSRF-Protection', '1');
  const first = await run();
  assert.equal(first.status, 200);
  assert.equal(first.body.provenance.dataset.id, 'aapl-minute');
  assert.equal(first.body.assumptions.accepted, true);
  assert.deepEqual((await run()).body, first.body);
  assert.equal(writes, 2);
  assert.equal(
    (await request(app).post(endpoint).set('Cookie', auth)).status,
    403
  );
  for (const role of ['USER', 'ADMIN', 'ROOT'])
    assert.equal(
      (
        await request(app)
          .post(endpoint)
          .set('Cookie', await cookie(store, OTHER, role))
          .set('X-CSRF-Protection', '1')
      ).status,
      404
    );
  stub(BacktestConfig, 'findOneAndUpdate', async () => null);
  assert.equal((await run()).status, 409);
  config.execution = { ...execution, accepted: false };
  assert.equal((await run()).status, 400);
});
