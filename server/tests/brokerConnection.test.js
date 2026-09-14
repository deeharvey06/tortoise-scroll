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
