import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.PASSWORD_RESET_DEV_EXPOSE_TOKEN = 'true';
process.env.SESSION_SECRET = 'test-only-session-secret-at-least-32-characters';

let app;
let User;
let SessionRecord;
let PasswordResetToken;
let AuditLog;
const users = new Map();
const sessions = new Map();
const resets = new Map();
const audits = [];
const originals = [];
const stub = (object, key, value) => {
  originals.push([object, key, object[key]]);
  object[key] = value;
};
const query = (value) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () =>
    Array.isArray(value)
      ? value.map((item) => ({ ...item }))
      : value
        ? { ...value }
        : value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});
const same = (a, b) => String(a) === String(b);

before(async () => {
  ({ default: User } = await import('../src/models/User.js'));
  ({ default: SessionRecord } = await import('../src/models/SessionRecord.js'));
  ({ default: PasswordResetToken } =
    await import('../src/models/PasswordResetToken.js'));
  ({ default: AuditLog } = await import('../src/models/AuditLog.js'));
  const { hashPassword } = await import('../src/auth/passwords.js');

  stub(User, 'exists', async ({ emailNormalized }) =>
    users.has(emailNormalized),
  );
  stub(User, 'create', async (data) => {
    const user = {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      status: 'ACTIVE',
      sessionVersion: 0,
      save: async function save() {
        users.set(this.emailNormalized, this);
        return this;
      },
    };
    users.set(user.emailNormalized, user);
    return user;
  });
  stub(User, 'findById', (id) =>
    query([...users.values()].find((user) => same(user._id, id)) || null),
  );
  stub(User, 'findOne', (filter) =>
    query(
      [...users.values()].find(
        (user) =>
          (!filter.emailNormalized ||
            user.emailNormalized === filter.emailNormalized) &&
          (!filter._id || same(user._id, filter._id)) &&
          (!filter.status || user.status === filter.status),
      ) || null,
    ),
  );

  stub(SessionRecord, 'findOneAndUpdate', async (filter, update) => {
    let record = [...sessions.values()].find(
      (item) => item.sessionId === filter.sessionId,
    );
    if (!record)
      record = {
        _id: new mongoose.Types.ObjectId(),
        sessionId: filter.sessionId,
        ...update.$setOnInsert,
      };
    Object.assign(record, update.$set);
    sessions.set(record.sessionId, record);
    return record;
  });
  stub(SessionRecord, 'find', (filter) =>
    query(
      [...sessions.values()].filter(
        (item) =>
          (!filter.userId || same(item.userId, filter.userId)) &&
          (!filter.expiresAt?.$gt || item.expiresAt > filter.expiresAt.$gt) &&
          (!filter.sessionId?.$ne || item.sessionId !== filter.sessionId.$ne),
      ),
    ),
  );
  stub(SessionRecord, 'findOne', (filter) =>
    query(
      [...sessions.values()].find(
        (item) =>
          same(item._id, filter._id) && same(item.userId, filter.userId),
      ) || null,
    ),
  );
  stub(SessionRecord, 'deleteOne', async (filter) => {
    const record = [...sessions.values()].find(
      (item) =>
        (filter.sessionId && item.sessionId === filter.sessionId) ||
        (filter._id &&
          same(item._id, filter._id) &&
          same(item.userId, filter.userId)),
    );
    if (record) sessions.delete(record.sessionId);
    return { deletedCount: record ? 1 : 0 };
  });
  stub(SessionRecord, 'deleteMany', async (filter) => {
    let count = 0;
    for (const record of [...sessions.values()])
      if (
        same(record.userId, filter.userId) &&
        (!filter.sessionId?.$ne || record.sessionId !== filter.sessionId.$ne)
      ) {
        sessions.delete(record.sessionId);
        count += 1;
      }
    return { deletedCount: count };
  });

  stub(PasswordResetToken, 'deleteMany', async (filter) => {
    for (const [hash, token] of resets)
      if (same(token.userId, filter.userId) && token.usedAt == null)
        resets.delete(hash);
  });
  stub(PasswordResetToken, 'create', async (data) => {
    const token = { ...data, _id: new mongoose.Types.ObjectId(), usedAt: null };
    resets.set(data.tokenHash, token);
    return token;
  });
  stub(PasswordResetToken, 'findOneAndUpdate', async (filter, update) => {
    const token = resets.get(filter.tokenHash);
    if (!token || token.usedAt || token.expiresAt <= filter.expiresAt.$gt)
      return null;
    Object.assign(token, update.$set);
    return token;
  });
  stub(AuditLog, 'create', async (data) => {
    audits.push(data);
    return data;
  });

  const authRoutes = (await import('../src/routes/authRoutes.js')).default;
  const securityRoutes = (
    await import('../src/routes/accountSecurityRoutes.js')
  ).default;
  const { requireAuth } = await import('../src/middleware/auth.js');
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  app = express();
  app.use(express.json());
  app.use(
    session({
      name: 'tortoise.sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 },
    }),
  );
  app.locals.sessionCookieName = 'tortoise.sid';
  app.locals.sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000,
    path: '/',
  };
  app.use('/api/auth', authRoutes);
  app.use('/api/account-security', requireAuth, securityRoutes);
  app.use(errorHandler);

  // Avoid an unused import while making the password helper initialize before tests race.
  assert.equal(typeof hashPassword, 'function');
});

after(() => {
  for (const [object, key, value] of originals.reverse()) object[key] = value;
});
beforeEach(() => {
  users.clear();
  sessions.clear();
  resets.clear();
  audits.length = 0;
});

async function registerAndLogin(agent, password = 'original-password-123') {
  if (!users.size)
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'trader@example.test', displayName: 'Trader', password });
  const response = await agent
    .post('/api/auth/login')
    .send({ email: 'trader@example.test', password });
  assert.equal(response.status, 200);
  return response;
}

test('individual session revocation and logout-others invalidate server sessions', async () => {
  const first = request.agent(app);
  const second = request.agent(app);
  const third = request.agent(app);
  await registerAndLogin(first);
  await registerAndLogin(second);
  await registerAndLogin(third);
  const active = await first.get('/api/account-security/sessions');
  assert.equal(active.status, 200);
  assert.equal(active.body.sessions.length, 3);
  const secondRecord = active.body.sessions.find((item) => !item.current);
  assert.equal(
    (await first.delete(`/api/account-security/sessions/${secondRecord.id}`))
      .status,
    204,
  );
  const statuses = [
    (await second.get('/api/auth/me')).status,
    (await third.get('/api/auth/me')).status,
  ];
  assert.ok(statuses.includes(401));
  assert.ok(statuses.includes(200));
  const logoutOthers = await first.post(
    '/api/account-security/sessions/logout-others',
  );
  assert.equal(logoutOthers.status, 200);
  assert.equal(logoutOthers.body.revoked, 1);
  assert.equal((await first.get('/api/auth/me')).status, 200);
  assert.equal((await second.get('/api/auth/me')).status, 401);
  assert.equal((await third.get('/api/auth/me')).status, 401);
});

test('password change requires current password, rotates current session, and revokes all others', async () => {
  const first = request.agent(app);
  const second = request.agent(app);
  await registerAndLogin(first);
  await registerAndLogin(second);
  // Simulate sessions created before the Phase 5 registry existed. The user-level
  // session version must still invalidate the dormant second session.
  sessions.clear();
  assert.equal(
    (
      await first.patch('/api/account-security/password').send({
        currentPassword: 'wrong',
        newPassword: 'new-password-value-123',
      })
    ).status,
    400,
  );
  const changed = await first.patch('/api/account-security/password').send({
    currentPassword: 'original-password-123',
    newPassword: 'new-password-value-123',
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.otherSessionsRevoked, 0);
  assert.equal((await first.get('/api/auth/me')).status, 200);
  assert.equal((await second.get('/api/auth/me')).status, 401);
  assert.equal(
    (
      await request(app).post('/api/auth/login').send({
        email: 'trader@example.test',
        password: 'original-password-123',
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(app).post('/api/auth/login').send({
        email: 'trader@example.test',
        password: 'new-password-value-123',
      })
    ).status,
    200,
  );
});

test('password reset is non-enumerating, single-use, expiring, and revokes every session', async () => {
  const first = request.agent(app);
  const second = request.agent(app);
  await registerAndLogin(first);
  await registerAndLogin(second);
  const unknown = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'unknown@example.test' });
  const known = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'trader@example.test' });
  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  assert.equal(unknown.body.message, known.body.message);
  assert.ok(known.body.developmentResetToken);
  assert.equal(unknown.body.developmentResetToken, undefined);
  assert.equal(
    resets.has(known.body.developmentResetToken),
    false,
    'raw reset token must never be stored',
  );
  assert.ok(
    [...resets.keys()].every((hash) => /^[a-f0-9]{64}$/.test(hash)),
    'only SHA-256 token hashes are stored',
  );
  const payload = {
    token: known.body.developmentResetToken,
    newPassword: 'reset-password-value-123',
  };
  assert.equal(
    (await request(app).post('/api/auth/reset-password').send(payload)).status,
    200,
  );
  assert.equal(
    (await request(app).post('/api/auth/reset-password').send(payload)).status,
    400,
  );
  assert.equal((await first.get('/api/auth/me')).status, 401);
  assert.equal((await second.get('/api/auth/me')).status, 401);
  const expiring = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'trader@example.test' });
  const activeToken = [...resets.values()].find(
    (token) => token.usedAt == null,
  );
  activeToken.expiresAt = new Date(0);
  assert.equal(
    (
      await request(app).post('/api/auth/reset-password').send({
        token: expiring.body.developmentResetToken,
        newPassword: 'another-password-123',
      })
    ).status,
    400,
  );
  assert.ok(audits.some((event) => event.action === 'PASSWORD_RESET'));
});

test('password change rejects password reuse and records security audit events without secrets', async () => {
  const agent = request.agent(app);
  await registerAndLogin(agent);
  const response = await agent.patch('/api/account-security/password').send({
    currentPassword: 'original-password-123',
    newPassword: 'original-password-123',
  });
  assert.equal(response.status, 400);
  await agent.post('/api/account-security/sessions/logout-others');
  const serialized = JSON.stringify(audits);
  assert.ok(audits.some((event) => event.action === 'OTHER_SESSIONS_REVOKED'));
  assert.equal(serialized.includes('original-password-123'), false);
});
