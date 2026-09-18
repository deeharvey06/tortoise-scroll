import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import session from 'express-session';
import request from 'supertest';
import User from '../src/models/User.js';
import SessionRecord from '../src/models/SessionRecord.js';
import {
  setupReplay,
  createInput,
  OWNER,
  OTHER,
} from './fixtures/replay/helpers.js';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET =
  'phase-five-test-session-secret-at-least-32-characters';
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
async function cookie(store, userId = OWNER, role = 'USER') {
  const id = crypto.randomUUID();
  users.set(userId, { _id: userId, role, status: 'ACTIVE', sessionVersion: 0 });
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
  const local = await setupReplay(t);
  const store = new session.MemoryStore();
  return {
    ...local,
    store,
    app: createApp({
      sessionStore: store,
      enforceCsrf: true,
      replayService: local.service,
    }),
  };
}
const protectedPost = (app, route, auth, body) =>
  request(app)
    .post(route)
    .set('Cookie', auth)
    .set('X-CSRF-Protection', '1')
    .send(body);

test('new replay routes enforce session authentication and mutation CSRF', async (t) => {
  const { app, store } = await setup(t);
  for (const route of [
    '/datasets',
    '/runs',
    `/runs/${OWNER}`,
    `/runs/${OWNER}/screenshots/abc`,
  ])
    assert.equal((await request(app).get(`/api/replay${route}`)).status, 401);
  const auth = await cookie(store);
  assert.equal(
    (
      await request(app)
        .post('/api/replay/runs')
        .set('Cookie', auth)
        .send(createInput)
    ).status,
    403
  );
  const blocked = await protectedPost(
    app,
    '/api/replay/runs',
    auth,
    createInput
  ).set('Origin', 'https://evil.test');
  assert.equal(blocked.status, 403);
});

test('HTTP responses expose only current completed candles and trusted timestamped decisions', async (t) => {
  const { app, store } = await setup(t);
  const auth = await cookie(store);
  const created = await protectedPost(
    app,
    '/api/replay/runs',
    auth,
    createInput
  );
  assert.equal(created.status, 201);
  assert.equal(created.body.candles.length, 0);
  assert.equal(created.body.historicalTrades, undefined);
  assert.equal(created.headers['cache-control'], 'no-store');
  const id = created.body.id;
  const advanced = await protectedPost(
    app,
    `/api/replay/runs/${id}/control`,
    auth,
    { action: 'step', count: 1, version: 0 }
  );
  assert.equal(advanced.status, 200);
  assert.equal(advanced.body.candles.length, 1);
  assert.equal(advanced.body.timestamp, '2026-03-09T13:31:00.000Z');
  assert.deepEqual(advanced.body.markers, []);
  assert.equal(advanced.body.comparison, null);
  const saved = await protectedPost(
    app,
    `/api/replay/runs/${id}/events`,
    auth,
    {
      kind: 'decision',
      action: 'Wait',
      text: 'No signal',
      confidence: 2,
      version: 1,
    }
  );
  assert.equal(saved.status, 201);
  assert.equal(saved.body.events[0].timestamp, advanced.body.timestamp);
  const stale = await protectedPost(
    app,
    `/api/replay/runs/${id}/control`,
    auth,
    { action: 'step', count: 1, version: 1 }
  );
  assert.equal(stale.status, 409);
  const bad = await protectedPost(app, `/api/replay/runs/${id}/events`, auth, {
    kind: 'decision',
    action: 'Long',
    text: 'bad',
    confidence: 3,
    version: 2,
    userId: OTHER,
    cursor: 100,
  });
  assert.equal(bad.status, 400);
});

for (const role of ['USER', 'ADMIN', 'ROOT']) {
  test(`${role} cannot access another user's run, events, controls or screenshots`, async (t) => {
    const { app, store, service } = await setup(t);
    const run = await service.create(OWNER, createInput);
    const auth = await cookie(store, OTHER, role);
    assert.deepEqual(
      (await request(app).get('/api/replay/runs').set('Cookie', auth)).body,
      []
    );
    assert.equal(
      (
        await request(app)
          .get(`/api/replay/runs/${run.id}?userId=${OWNER}`)
          .set('Cookie', auth)
      ).status,
      404
    );
    for (const [route, body] of [
      ['control', { action: 'step', count: 1, version: 0 }],
      ['events', { kind: 'note', text: 'foreign', version: 0 }],
    ]) {
      assert.equal(
        (
          await protectedPost(
            app,
            `/api/replay/runs/${run.id}/${route}`,
            auth,
            body
          )
        ).status,
        404
      );
    }
    assert.equal(
      (
        await request(app)
          .get(`/api/replay/runs/${run.id}/screenshots/abc`)
          .set('Cookie', auth)
      ).status,
      404
    );
  });
}

test('a suspended user cannot resume existing runs', async (t) => {
  const { app, store, service } = await setup(t);
  const run = await service.create(OWNER, createInput);
  const auth = await cookie(store);
  users.get(OWNER).status = 'SUSPENDED';
  assert.equal(
    (await request(app).get(`/api/replay/runs/${run.id}`).set('Cookie', auth))
      .status,
    403
  );
});
