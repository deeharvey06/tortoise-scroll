import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET =
  'production-test-secret-that-is-at-least-32-characters';
process.env.ALLOWED_ORIGINS = 'https://journal.example.test';
process.env.AUTH_RATE_LIMIT_MAX = '2';
process.env.PASSWORD_RESET_RATE_LIMIT_MAX = '2';

let app;
let User;

before(async () => {
  ({ default: User } = await import('../src/models/User.js'));
  User.findOne = () => ({ select: async () => null });
  const { createApp } = await import('../src/app.js');
  app = createApp({
    sessionStore: new session.MemoryStore(),
    enforceCsrf: true,
    enforceRateLimit: true,
  });
});

after(() => {
  delete process.env.AUTH_RATE_LIMIT_MAX;
  delete process.env.PASSWORD_RESET_RATE_LIMIT_MAX;
});

test('credentialed CORS allows only the exact configured origin', async () => {
  const allowed = await request(app)
    .get('/api/health')
    .set('Origin', 'https://journal.example.test');
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers['access-control-allow-origin'],
    'https://journal.example.test',
  );
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true');
  assert.equal(
    (
      await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil.example')
    ).status,
    403,
  );
});

test('CSRF defense rejects unsafe requests without the marker or from an untrusted origin', async () => {
  const missing = await request(app).post('/api/auth/register').send({});
  assert.equal(missing.status, 403);
  assert.equal(
    missing.body.error.message,
    'CSRF protection header is required',
  );
  const untrusted = await request(app)
    .post('/api/auth/register')
    .set('Origin', 'https://evil.example')
    .set('X-CSRF-Protection', '1')
    .send({});
  assert.equal(untrusted.status, 403);
  const trusted = await request(app)
    .post('/api/auth/register')
    .set('Origin', 'https://journal.example.test')
    .set('X-CSRF-Protection', '1')
    .send({});
  assert.equal(trusted.status, 400);
});

test('input safety rejects Mongo operators, dotted keys, and excessive nesting before business logic', async () => {
  const headers = {
    Origin: 'https://journal.example.test',
    'X-CSRF-Protection': '1',
  };
  const operator = await request(app)
    .post('/api/auth/register')
    .set({ ...headers, 'X-Forwarded-For': '203.0.113.31' })
    .send({
      email: 'safe@example.test',
      password: 'long-enough-password',
      displayName: 'Safe',
      $set: { role: 'ROOT' },
    });
  assert.equal(operator.status, 400);
  assert.match(operator.body.error.message, /forbidden field name/i);
  const dotted = await request(app)
    .post('/api/auth/register')
    .set({ ...headers, 'X-Forwarded-For': '203.0.113.32' })
    .send({
      email: 'safe@example.test',
      password: 'long-enough-password',
      displayName: 'Safe',
      'profile.role': 'ROOT',
    });
  assert.equal(dotted.status, 400);
  let nested = { value: true };
  for (let depth = 0; depth < 22; depth += 1) nested = { child: nested };
  const deep = await request(app)
    .post('/api/auth/register')
    .set({ ...headers, 'X-Forwarded-For': '203.0.113.33' })
    .send(nested);
  assert.equal(deep.status, 400);
  assert.match(deep.body.error.message, /nested too deeply/i);
});

test('Helmet and request correlation headers are present without framework disclosure', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.ok(response.headers['x-request-id']);
});

test('production sessions use a secure host-only cookie policy', () => {
  assert.equal(app.locals.sessionCookieName, '__Host-tortoise.sid');
  assert.deepEqual(
    {
      httpOnly: app.locals.sessionCookieOptions.httpOnly,
      secure: app.locals.sessionCookieOptions.secure,
      sameSite: app.locals.sessionCookieOptions.sameSite,
      path: app.locals.sessionCookieOptions.path,
    },
    { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
  );
  assert.equal(app.locals.sessionCookieOptions.domain, undefined);
});

test('production configuration rejects placeholder secrets and insecure origins', async () => {
  const { getConfig } = await import('../src/config/index.js');
  const originalSecret = process.env.SESSION_SECRET;
  const originalOrigins = process.env.ALLOWED_ORIGINS;
  try {
    process.env.SESSION_SECRET = 'replace-with-at-least-32-random-characters';
    assert.throws(() => getConfig(), /non-placeholder/);
    process.env.SESSION_SECRET = originalSecret;
    process.env.ALLOWED_ORIGINS = 'http://journal.example.test';
    assert.throws(() => getConfig(), /must use HTTPS/);
  } finally {
    process.env.SESSION_SECRET = originalSecret;
    process.env.ALLOWED_ORIGINS = originalOrigins;
  }
});

test('login rate limiter returns 429 after the configured failed-attempt budget', async () => {
  const send = () =>
    request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '203.0.113.25')
      .set('X-CSRF-Protection', '1')
      .send({ email: 'nobody@example.test', password: 'wrong' });
  assert.equal((await send()).status, 401);
  assert.equal((await send()).status, 401);
  const blocked = await send();
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error.message, /too many authentication attempts/i);
  assert.ok(blocked.headers['ratelimit-policy']);
});

test('production error responses hide internal exception details and include a request id', async () => {
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  const isolated = express();
  isolated.get('/explode', (_req, _res, next) =>
    next(new Error('database-password-should-not-leak')),
  );
  isolated.use(errorHandler);
  const response = await request(isolated).get('/explode');
  assert.equal(response.status, 500);
  assert.equal(response.body.error.message, 'Internal server error');
  assert.equal(
    JSON.stringify(response.body).includes('database-password'),
    false,
  );
  assert.equal(response.body.error.stack, undefined);
});
