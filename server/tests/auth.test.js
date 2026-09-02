import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import request from 'supertest';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-at-least-32-characters';

let app;
let User;
let SessionRecord;
let passwordApi;
let middleware;
const users = new Map();
const query = (value) => ({
  select: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});
before(async () => {
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: SessionRecord } = await import('../src/models/SessionRecord.js'));
  SessionRecord.findOneAndUpdate = async () => null;
  SessionRecord.deleteOne = async () => ({ deletedCount: 1 });
  User.exists = async ({ emailNormalized }) => users.has(emailNormalized);
  User.create = async (data) => {
    const user = {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      status: data.status || 'ACTIVE',
      save: async function save() {
        users.set(this.emailNormalized, this);
        return this;
      },
    };
    users.set(user.emailNormalized, user);
    return user;
  };
  User.findOne = ({ emailNormalized }) =>
    query(users.get(emailNormalized) || null);
  User.findById = (id) =>
    query(
      [...users.values()].find((user) => String(user._id) === String(id)) ||
        null,
    );
  User.countDocuments = async () => users.size;
  passwordApi = await import('../src/auth/passwords.js');
  middleware = await import('../src/middleware/auth.js');
  const { createApp } = await import('../src/app.js');
  app = createApp({ sessionStore: new session.MemoryStore() });
});
beforeEach(() => {
  users.clear();
});

const valid = {
  email: 'Trader@Example.com',
  password: 'a-strong-password-123',
  displayName: 'Test Trader',
};

test('Argon2id hashes and verifies passwords', async () => {
  const hash = await passwordApi.hashPassword(valid.password);
  assert.notEqual(hash, valid.password);
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await passwordApi.verifyPassword(hash, valid.password), true);
  assert.equal(
    await passwordApi.verifyPassword(hash, 'incorrect-password'),
    false,
  );
});

test('registration creates only a safe USER and rejects duplicates', async () => {
  const first = await request(app).post('/api/auth/register').send(valid);
  assert.equal(first.status, 201);
  assert.deepEqual(Object.keys(first.body.user).sort(), [
    'displayName',
    'email',
    'id',
    'role',
    'status',
  ]);
  assert.equal(first.body.user.role, 'USER');
  const stored = await User.findOne({
    emailNormalized: 'trader@example.com',
  }).select('+passwordHash');
  assert.ok(stored.passwordHash);
  assert.equal(stored.emailNormalized, 'trader@example.com');
  assert.equal(
    (await request(app).post('/api/auth/register').send(valid)).status,
    409,
  );
});

for (const attack of [
  { role: 'ADMIN' },
  { role: 'ROOT' },
  { isAdmin: true },
  { isRoot: true },
  { permissions: ['ROOT'] },
  { status: 'ACTIVE' },
]) {
  test(`registration rejects privilege field ${Object.keys(attack)[0]}`, async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, ...attack });
    assert.equal(response.status, 400);
    assert.equal(await User.countDocuments(), 0);
  });
}

test('login creates/regenerates a session and /me returns safe identity', async () => {
  await request(app).post('/api/auth/register').send(valid);
  const agent = request.agent(app);
  const login = await agent
    .post('/api/auth/login')
    .send({ email: 'TRADER@example.com', password: valid.password });
  assert.equal(login.status, 200);
  const firstCookie = login.headers['set-cookie'][0];
  assert.match(firstCookie, /HttpOnly/);
  assert.match(firstCookie, /SameSite=Lax/);
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, valid.email);
  assert.equal(me.body.user.passwordHash, undefined);
  const secondLogin = await agent
    .post('/api/auth/login')
    .send({ email: valid.email, password: valid.password });
  assert.notEqual(secondLogin.headers['set-cookie'][0], firstCookie);
});

test('invalid password and unknown email use the same generic response', async () => {
  await request(app).post('/api/auth/register').send(valid);
  const bad = await request(app)
    .post('/api/auth/login')
    .send({ email: valid.email, password: 'wrong' });
  const unknown = await request(app)
    .post('/api/auth/login')
    .send({ email: 'unknown@example.com', password: 'wrong' });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.error.message, unknown.body.error.message);
});

test('/me is unauthenticated without a session; logout destroys an existing session', async () => {
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  await request(app).post('/api/auth/register').send(valid);
  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .send({ email: valid.email, password: valid.password });
  assert.equal((await agent.post('/api/auth/logout')).status, 204);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('role middleware denies USER/ADMIN root access and allows ROOT', () => {
  const guard = middleware.requireRoot;
  for (const role of ['USER', 'ADMIN']) {
    let error;
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
    };
    guard({ user: { role } }, res, (value) => {
      error = value;
    });
    assert.equal(res.statusCode, 403);
    assert.ok(error);
  }
  let called = false;
  guard({ user: { role: 'ROOT' } }, {}, () => {
    called = true;
  });
  assert.equal(called, true);
});

test('requireAuthentication rejects requests without a session', async () => {
  let error;
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
  await middleware.requireAuthentication({}, res, (value) => {
    error = value;
  });
  assert.equal(res.statusCode, 401);
  assert.ok(error);
});
