import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  encryptSecret,
  decryptSecret,
  redactConnection,
} from '../src/services/brokerSecretService.js';
import {
  registerBrokerProvider,
  getBrokerProvider,
  listBrokerProviders,
} from '../src/services/brokers/providerRegistry.js';

const key = crypto.randomBytes(32).toString('base64');
process.env.BROKER_TOKEN_ENCRYPTION_KEYS = `test:${key}`;
process.env.BROKER_TOKEN_ACTIVE_KEY_ID = 'test';

test('broker secret encryption round-trips without storing plaintext', () => {
  const encrypted = encryptSecret('highly-sensitive-token');
  assert.equal(encrypted.keyId, 'test');
  assert.notEqual(encrypted.ciphertext, 'highly-sensitive-token');
  assert.equal(decryptSecret(encrypted), 'highly-sensitive-token');
});

test('redacted broker connection never returns encrypted token material', () => {
  const value = redactConnection({
    _id: 'connection',
    provider: 'thinkorswim',
    accessTokenEncrypted: { ciphertext: 'secret' },
    refreshTokenEncrypted: { ciphertext: 'secret2' },
  });
  assert.equal(value.accessTokenEncrypted, undefined);
  assert.equal(value.refreshTokenEncrypted, undefined);
  assert.equal(value.provider, 'thinkorswim');
});

test('provider registry exposes capabilities but not credentials', () => {
  registerBrokerProvider({
    key: 'test-provider',
    label: 'Test Provider',
    getCapabilities: () => ({ executions: true }),
  });
  assert.equal(getBrokerProvider('test-provider').key, 'test-provider');
  const publicProvider = listBrokerProviders().find(
    (p) => p.key === 'test-provider'
  );
  assert.deepEqual(publicProvider.capabilities, { executions: true });
});

import { thinkorswimProvider } from '../src/services/brokers/thinkorswimProvider.js';

test('Thinkorswim provider builds authorization URL without exposing a secret', () => {
  process.env.THINKORSWIM_CLIENT_ID = 'client-id';
  const url = new URL(
    thinkorswimProvider.beginAuthorization({
      state: 'state-value',
      redirectUri:
        'http://localhost:5050/api/broker-connections/thinkorswim/callback',
    })
  );
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.has('client_secret'), false);
});

test('Thinkorswim API order executions normalize into the Phase 2 execution model', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify([
        {
          orderId: 42,
          orderLegCollection: [
            {
              legId: 1,
              instruction: 'BUY_TO_OPEN',
              instrument: { symbol: 'AAPL', assetType: 'EQUITY' },
            },
          ],
          orderActivityCollection: [
            {
              activityType: 'EXECUTION',
              executionLegs: [
                {
                  id: 'exec-1',
                  legId: 1,
                  quantity: 2,
                  price: 200.5,
                  time: '2026-09-10T15:30:00Z',
                },
              ],
            },
          ],
        },
      ]),
  });
  try {
    const result = await thinkorswimProvider.fetchExecutions('token', {
      providerAccountId: 'hash',
      from: '2026-09-10T00:00:00Z',
    });
    assert.equal(result.executions.length, 1);
    assert.equal(result.executions[0].executionId, 'exec-1');
    assert.equal(result.executions[0].executionKey, 'id:exec-1');
    assert.equal(result.executions[0].positionEffect, 'open');
    assert.equal(result.executions[0].quantity, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Thinkorswim authorization fails closed when client ID is not configured', () => {
  const originalThink = process.env.THINKORSWIM_CLIENT_ID;
  const originalSchwab = process.env.SCHWAB_CLIENT_ID;
  delete process.env.THINKORSWIM_CLIENT_ID;
  delete process.env.SCHWAB_CLIENT_ID;
  try {
    assert.throws(
      () =>
        thinkorswimProvider.beginAuthorization({
          state: 's',
          redirectUri: 'http://localhost/callback',
        }),
      /client ID is not configured/i
    );
  } finally {
    if (originalThink === undefined) delete process.env.THINKORSWIM_CLIENT_ID;
    else process.env.THINKORSWIM_CLIENT_ID = originalThink;
    if (originalSchwab === undefined) delete process.env.SCHWAB_CLIENT_ID;
    else process.env.SCHWAB_CLIENT_ID = originalSchwab;
  }
});

test('Thinkorswim account discovery normalizes account metadata and filters missing IDs', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify([
        {
          hashValue: 'hash-1',
          accountNumber: '12345678',
          type: 'MARGIN',
          isDayTrader: true,
        },
        { securitiesAccount: { accountNumber: '87654321', type: 'CASH' } },
        { securitiesAccount: { type: 'UNKNOWN' } },
      ]),
  });
  try {
    const accounts = await thinkorswimProvider.getAccounts('token');
    assert.equal(accounts.length, 2);
    assert.equal(accounts[0].providerAccountId, 'hash-1');
    assert.equal(accounts[0].providerAccountNumberMasked, '…5678');
    assert.equal(accounts[0].raw.isDayTrader, true);
    assert.equal(accounts[1].providerAccountId, '87654321');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Thinkorswim OAuth completion and refresh send server-side basic authorization', async () => {
  const originalFetch = global.fetch;
  const oldId = process.env.THINKORSWIM_CLIENT_ID;
  const oldSecret = process.env.THINKORSWIM_CLIENT_SECRET;
  process.env.THINKORSWIM_CLIENT_ID = 'id';
  process.env.THINKORSWIM_CLIENT_SECRET = 'secret';
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ access_token: 'access', refresh_token: 'refresh' }),
    };
  };
  try {
    await thinkorswimProvider.completeAuthorization({
      code: 'code',
      redirectUri: 'http://localhost/cb',
    });
    await thinkorswimProvider.refreshAuthorization('refresh-old');
    assert.equal(calls.length, 2);
    assert.match(calls[0].options.headers.Authorization, /^Basic /);
    assert.match(
      String(calls[0].options.body),
      /grant_type=authorization_code/
    );
    assert.match(String(calls[1].options.body), /grant_type=refresh_token/);
  } finally {
    global.fetch = originalFetch;
    if (oldId === undefined) delete process.env.THINKORSWIM_CLIENT_ID;
    else process.env.THINKORSWIM_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.THINKORSWIM_CLIENT_SECRET;
    else process.env.THINKORSWIM_CLIENT_SECRET = oldSecret;
  }
});

test('Thinkorswim position fetch normalizes long and short quantities and drops blank symbols', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        securitiesAccount: {
          positions: [
            {
              longQuantity: 3,
              shortQuantity: 1,
              averagePrice: 6000,
              instrument: { symbol: '/ESZ26', assetType: 'FUTURE' },
            },
            {
              longQuantity: 0,
              shortQuantity: 2,
              averagePrice: 200,
              instrument: { symbol: 'AAPL', assetType: 'EQUITY' },
            },
            { longQuantity: 1, shortQuantity: 0, instrument: {} },
          ],
        },
      }),
  });
  try {
    const positions = await thinkorswimProvider.fetchPositions('token', {
      providerAccountId: 'hash',
    });
    assert.deepEqual(
      positions.map((p) => [p.symbol, p.quantity]),
      [
        ['/ESZ26', 2],
        ['AAPL', -2],
      ]
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('Thinkorswim derivative execution without cost data reports a reconciliation warning', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify([
        {
          orderId: 7,
          orderLegCollection: [
            {
              legId: 1,
              instruction: 'SELL_TO_CLOSE',
              instrument: { symbol: '/ESZ26', assetType: 'FUTURE' },
            },
          ],
          orderActivityCollection: [
            {
              activityType: 'EXECUTION',
              executionLegs: [
                {
                  id: 'f1',
                  legId: 1,
                  quantity: 1,
                  price: 6001,
                  time: '2026-09-10T16:00:00Z',
                },
              ],
            },
          ],
        },
      ]),
  });
  try {
    const result = await thinkorswimProvider.fetchExecutions('token', {
      providerAccountId: 'hash',
      from: '2026-09-10T00:00:00Z',
      to: '2026-09-11T00:00:00Z',
    });
    assert.equal(result.executions.length, 1);
    assert.equal(result.executions[0].positionEffect, 'close');
    assert.match(result.warnings.join(' '), /commission\/fee data/i);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Thinkorswim provider converts HTTP failures and classifies broker errors', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => JSON.stringify({ message: 'slow down' }),
  });
  try {
    await assert.rejects(
      () => thinkorswimProvider.getAccounts('token'),
      (error) => {
        assert.equal(error.providerStatus, 429);
        assert.equal(error.message, 'slow down');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(
    thinkorswimProvider.normalizeBrokerError({ providerStatus: 401 }).code,
    'AUTHORIZATION_EXPIRED'
  );
  assert.equal(
    thinkorswimProvider.normalizeBrokerError({ providerStatus: 429 }).code,
    'RATE_LIMITED'
  );
  assert.equal(
    thinkorswimProvider.normalizeBrokerError({
      providerStatus: 503,
      message: 'down',
    }).code,
    'PROVIDER_UNAVAILABLE'
  );
  assert.equal(
    thinkorswimProvider.normalizeBrokerError({
      providerStatus: 400,
      message: 'bad',
    }).code,
    'BROKER_REQUEST_FAILED'
  );
  assert.equal(
    thinkorswimProvider.normalizeBrokerError(new Error('offline')).code,
    'PROVIDER_UNAVAILABLE'
  );
});

test('broker secret helpers cover nulls, key validation, missing keys and document redaction', () => {
  assert.equal(encryptSecret(''), null);
  assert.equal(decryptSecret(null), '');

  const originalKeys = process.env.BROKER_TOKEN_ENCRYPTION_KEYS;
  const originalActive = process.env.BROKER_TOKEN_ACTIVE_KEY_ID;
  try {
    process.env.BROKER_TOKEN_ENCRYPTION_KEYS = 'bad-entry,short:aGVsbG8=';
    process.env.BROKER_TOKEN_ACTIVE_KEY_ID = 'short';
    assert.throws(() => encryptSecret('x'), /32-byte base64/i);

    process.env.BROKER_TOKEN_ENCRYPTION_KEYS = `test:${key}`;
    process.env.BROKER_TOKEN_ACTIVE_KEY_ID = 'missing';
    assert.throws(() => encryptSecret('x'), /not configured/i);

    process.env.BROKER_TOKEN_ACTIVE_KEY_ID = 'test';
    assert.throws(
      () =>
        decryptSecret({ keyId: 'unknown', iv: '', tag: '', ciphertext: '' }),
      /unavailable/i
    );

    const redacted = redactConnection({
      toObject: () => ({
        provider: 'thinkorswim',
        accessTokenEncrypted: { ciphertext: 'x' },
        refreshTokenEncrypted: { ciphertext: 'y' },
      }),
    });
    assert.equal(redacted.provider, 'thinkorswim');
    assert.equal(redacted.accessTokenEncrypted, undefined);
  } finally {
    process.env.BROKER_TOKEN_ENCRYPTION_KEYS = originalKeys;
    process.env.BROKER_TOKEN_ACTIVE_KEY_ID = originalActive;
  }
});

test('provider registry rejects invalid and unknown providers', () => {
  assert.throws(() => registerBrokerProvider(null), /requires a key/i);
  assert.throws(
    () => getBrokerProvider('does-not-exist'),
    /Unsupported broker provider/i
  );
});
