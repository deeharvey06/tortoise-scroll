import test from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyCredentials,
  createSessionToken,
  getAuthUserByUsername,
  decodeSessionToken,
} from '../src/auth/users.js';

test('demo user verifies with the configured demo password', () => {
  const result = verifyCredentials('demo', 'demo123');
  assert.deepEqual(result, {
    username: 'demo',
    displayName: 'Demo User',
    role: 'demo',
  });
});

test('root user verifies and resolves the display name as My Account', () => {
  const result = verifyCredentials('root', 'root123');
  assert.deepEqual(result, {
    username: 'root',
    displayName: 'My Account',
    role: 'admin',
  });
});

test('login token contains the resolved user identity', () => {
  const token = createSessionToken('root');
  const user = getAuthUserByUsername('root');

  assert.ok(token);
  assert.equal(user.displayName, 'My Account');
  assert.equal(user.role, 'admin');
});

test('tampered token is rejected instead of being trusted', () => {
  const token = `${createSessionToken('root')}.tampered`;
  const decoded = decodeSessionToken(token);

  assert.equal(decoded, null);
});
