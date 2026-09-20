import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { operationsConfig } from '../src/config/operations.js';
import { createLogger } from '../src/config/logger.js';
import { SmtpEmailProvider } from '../src/services/email/SmtpEmailProvider.js';
import { createEmailProvider } from '../src/services/email/index.js';
import { createReadiness, storageHealth } from '../src/operations/health.js';
import { createShutdown } from '../src/operations/shutdown.js';
import { MongoRateLimitStore } from '../src/operations/rateLimitStore.js';
import { JobQueue } from '../src/queue/jobQueue.js';
import { requestLogger } from '../src/middleware/requestLogger.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const base = {
  nodeEnv: 'production',
  clientOrigin: 'https://journal.test',
  allowedOrigins: ['https://journal.test'],
};
const production = () => ({
  MONGO_URI: 'mongodb://ops:database-secret@db.internal/journal?tls=true',
  ALLOWED_ORIGINS: 'https://journal.test',
  CLIENT_ORIGIN: 'https://journal.test',
  PASSWORD_RESET_URL: 'https://journal.test/reset-password',
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'reset@journal.test',
  SMTP_HOST: 'smtp.internal',
  SMTP_USER: 'journal',
  SMTP_PASSWORD: 'mail-credential-value',
  TRUST_PROXY: '10.0.0.0/24',
  UPLOADS_DIR: '/var/lib/tortoise/uploads',
  UPLOADS_STORAGE_MODE: 'local',
});
test('production operations config rejects missing/insecure settings and accepts explicit deployment settings', () => {
  assert.equal(operationsConfig(base, production()).rateLimitStore, 'mongo');
  const invalid = {
    MONGO_URI: [
      '',
      'mongodb://db/journal',
      'mongodb://u:p@db/journal?tls=true&tlsAllowInvalidCertificates=true',
    ],
    EMAIL_PROVIDER: ['disabled', 'unknown'],
    SMTP_PASSWORD: ['', 'change-me'],
    PASSWORD_RESET_URL: [
      'http://journal.test/reset-password',
      'https://evil.test/reset-password',
      'https://journal.test/reset-password?token=secret',
    ],
    RATE_LIMIT_STORE: ['memory'],
    TRUST_PROXY: ['true', '0.0.0.0/0', '1'],
    UPLOADS_DIR: ['', 'relative'],
    UPLOADS_STORAGE_MODE: [''],
    PASSWORD_RESET_DEV_EXPOSE_TOKEN: ['true'],
    NODE_TLS_REJECT_UNAUTHORIZED: ['0'],
    SHUTDOWN_TIMEOUT_MS: ['0', 'NaN'],
    SMTP_SECURE: ['yes'],
    SMTP_PORT: ['-1'],
  };
  for (const [key, values] of Object.entries(invalid))
    for (const value of values)
      assert.throws(
        () => operationsConfig(base, { ...production(), [key]: value }),
        undefined,
        key
      );
  assert.throws(() =>
    operationsConfig(base, { ...production(), DEPLOYMENT_MODE: 'multi' })
  );
  assert.equal(
    operationsConfig(base, {
      ...production(),
      DEPLOYMENT_MODE: 'multi',
      UPLOADS_STORAGE_MODE: 'shared',
      BROKER_SYNC_SCHEDULER_ENABLED: 'false',
    }).deploymentMode,
    'multi'
  );
});
test('development defaults remain local and never send mail automatically', () => {
  const config = operationsConfig(
    { ...base, nodeEnv: 'development', clientOrigin: 'http://localhost:5173' },
    {}
  );
  assert.equal(config.email.provider, 'disabled');
  assert.equal(config.rateLimitStore, 'memory');
  assert.equal(config.trustProxy, false);
  assert.equal(createEmailProvider(config).enabled, false);
  assert.throws(() => createEmailProvider({ email: { provider: 'unknown' } }));
});
test('structured logging excludes credentials at all depths, error text, arbitrary strings and URLs', () => {
  let output = '';
  const log = createLogger(
    new Writable({
      write(chunk, _encoding, done) {
        output += chunk;
        done();
      },
    })
  );
  const secret = 'DO_NOT_LOG_SENSITIVE_VALUE';
  log.info(
    {
      event: 'SECURITY_TEST',
      password: secret,
      token: secret,
      sessionSecret: secret,
      sessionId: secret,
      csrfSecret: secret,
      headers: { cookie: secret, authorization: secret },
      body: { newPassword: secret },
      nested: { token: secret },
      url: `/reset?token=${secret}`,
      requestId: secret,
    },
    secret
  );
  log.error(new Error(secret));
  log.warn(secret);
  log
    .child({ sessionSecret: secret, headers: { cookie: secret } })
    .info({ event: 'CHILD_LOG_TEST' });
  assert.ok(!output.includes(secret));
  assert.match(output, /SECURITY_TEST/);
  for (const line of output.trim().split('\n'))
    assert.doesNotThrow(() => JSON.parse(line));
});
test('SMTP adapter requires TLS, suppresses protocol logging and accepts only successful recipient delivery', async () => {
  const config = operationsConfig(base, production()).email;
  let sent;
  const transport = {
    sendMail: async (message) => {
      sent = message;
      return { accepted: [message.to] };
    },
    verify: async () => true,
    close() {},
  };
  const provider = new SmtpEmailProvider(config, transport);
  await provider.verify();
  assert.equal(provider.healthy, true);
  await provider.sendPasswordReset({
    to: 'owner@journal.test',
    url: 'https://journal.test/reset-password?token=private',
    expiresInMinutes: 30,
  });
  assert.match(sent.text, /token=private/);
  assert.equal(sent.from, config.from);
  transport.sendMail = async () => ({ accepted: [] });
  await assert.rejects(
    provider.sendPasswordReset({ to: 'owner@journal.test' })
  );
  assert.equal(provider.healthy, false);
  transport.verify = async () => {
    throw new Error('credential response');
  };
  await assert.rejects(provider.verify());
  await provider.close();
  const actual = new SmtpEmailProvider(config);
  assert.equal(actual.transport.options.requireTLS, true);
  assert.equal(actual.transport.options.tls.rejectUnauthorized, true);
  assert.equal(actual.transport.options.debug, false);
  assert.equal(actual.transport.options.logger, false);
  await actual.close();
});
test('readiness reports dependency failures, caches probes, and immediately goes unready while draining', async () => {
  const state = { draining: false };
  let calls = 0;
  const ready = createReadiness({
    state,
    databaseCheck: async () => {
      calls++;
      return true;
    },
    storageCheck: async () => true,
    email: { enabled: false },
  });
  assert.equal((await ready()).status, 'ready');
  await ready();
  assert.equal(calls, 1);
  state.draining = true;
  assert.equal((await ready()).status, 'not_ready');
  for (const checks of [
    { databaseCheck: async () => false, storageCheck: async () => true },
    {
      databaseCheck: async () => true,
      storageCheck: async () => {
        throw new Error('secret path');
      },
    },
  ]) {
    const result = await createReadiness({
      state: { draining: false },
      ...checks,
    })();
    assert.equal(result.status, 'not_ready');
    assert.ok(!JSON.stringify(result).includes('secret'));
  }
});
test('storage readiness checks write/read/delete and rejects missing storage', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'operations-storage-'));
  try {
    assert.equal(await storageHealth(root), true);
    assert.deepEqual(await fs.readdir(root), []);
    assert.equal(await storageHealth(path.join(root, 'missing')), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test('request and error IDs are generated independently of client input', async () => {
  const app = express();
  app.use(requestLogger);
  app.get('/failure', (_req, _res, next) => next(new Error('failure')));
  app.use(errorHandler);
  const response = await request(app)
    .get('/failure?token=never-log')
    .set('X-Request-Id', 'client-secret');
  assert.equal(response.status, 500);
  assert.notEqual(response.headers['x-request-id'], 'client-secret');
  assert.equal(response.headers['x-error-id'], response.body.error.errorId);
  assert.notEqual(response.body.error.errorId, response.body.error.requestId);
});
test('shutdown drains once before closing resources, even with repeated signals', async () => {
  const events = [],
    state = { draining: false };
  const stop = createShutdown({
    state,
    server: {
      close(done) {
        events.push('http');
        done();
      },
      closeIdleConnections() {},
    },
    stopScheduling: async () => events.push('scheduler'),
    drainJobs: async () => events.push('jobs'),
    closeResources: async () => events.push('resources'),
    forceExit: () => assert.fail('unexpected force exit'),
  });
  const first = stop();
  assert.equal(state.draining, true);
  assert.equal(stop(), first);
  await first;
  assert.equal(events.at(-1), 'resources');
  assert.equal(events.filter((v) => v === 'http').length, 1);
});
test('shutdown deadline forces a stalled connection closed', async () => {
  let release,
    forced = false,
    closed = false;
  const stop = createShutdown({
    state: {},
    server: {
      close(done) {
        release = done;
      },
      closeAllConnections() {
        closed = true;
      },
    },
    stopScheduling: async () => {},
    drainJobs: async () => {},
    closeResources: async () => {},
    timeoutMs: 10,
    forceExit: () => {
      forced = true;
      release();
    },
  });
  await stop();
  assert.equal(forced, true);
  assert.equal(closed, true);
});
test('shared limiter fails closed without exposing backend errors', async () => {
  const store = new MongoRateLimitStore('login', () => {
    throw new Error('mongodb://credential:private@host');
  });
  store.init({ windowMs: 1000 });
  await assert.rejects(
    store.increment('127.0.0.1'),
    (error) => error.statusCode === 503 && !error.message.includes('credential')
  );
});
test('queue shutdown drains all pending work and rejects new submissions', async () => {
  const queue = new JobQueue();
  let completed = 0;
  queue.register('fixture', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed++;
  });
  for (let i = 0; i < 10; i++) await queue.enqueue('fixture');
  await queue.drain();
  assert.equal(completed, 10);
  await assert.rejects(
    queue.enqueue('fixture'),
    (error) => error.statusCode === 503
  );
});

test('email dispatch does not wait on provider latency, is bounded, and drains on shutdown', async () => {
  const { EmailDelivery } = await import('../src/services/email/delivery.js');
  let finish;
  const dispatcher = new EmailDelivery(
    {
      sendPasswordReset: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    1
  );
  assert.equal(dispatcher.submit({ url: 'private-reset-link' }), true);
  assert.equal(dispatcher.submit({ url: 'another-private-link' }), false);
  await Promise.resolve();
  const draining = dispatcher.drain();
  assert.equal(dispatcher.submit({}), false);
  finish();
  await draining;
  assert.equal(dispatcher.pending.size, 0);
});

test('HTTP liveness bypasses failed dependencies while readiness and shared limiter fail safely', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const { createApp } = await import('../src/app.js');
    const { default: session } = await import('express-session');
    const app = createApp({
      sessionStore: new session.MemoryStore(),
      enforceRateLimit: true,
      healthChecks: {
        databaseCheck: async () => false,
        storageCheck: async () => false,
      },
      rateLimitStoreFactory: (name) =>
        new MongoRateLimitStore(name, () => {
          throw new Error('private-connection-details');
        }),
    });
    assert.equal((await request(app).get('/api/health')).status, 200);
    const ready = await request(app).get('/api/ready');
    assert.equal(ready.status, 503);
    assert.equal(ready.body.checks.database, 'down');
    const failed = await request(app)
      .post('/api/auth/login')
      .send({ email: 'someone@example.test', password: 'not-a-real-password' });
    assert.equal(failed.status, 503);
    assert.ok(
      !JSON.stringify(failed.body).includes('private-connection-details')
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
