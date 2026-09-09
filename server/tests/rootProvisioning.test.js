import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import { provisionRootUser } from '../src/auth/rootProvisioning.js';

const originalFindOne = User.findOne;

const query = (value) => ({
  select: async () => value,
});

test.after(() => {
  User.findOne = originalFindOne;
  delete process.env.ROOT_USER_EMAIL;
});

test('refuses to promote a pre-registered matching USER account', async () => {
  process.env.ROOT_USER_EMAIL = 'root@example.test';
  const user = { role: 'USER', status: 'ACTIVE' };
  User.findOne = (filter) => (filter.role ? null : query(user));

  await assert.rejects(
    () => provisionRootUser(),
    /belongs to a non-ROOT account; refusing promotion/,
  );
  assert.equal(user.role, 'USER');
});

test('refuses to reactivate an inactive matching ROOT account', async () => {
  process.env.ROOT_USER_EMAIL = 'root@example.test';
  const root = { role: 'ROOT', status: 'SUSPENDED' };
  User.findOne = (filter) => (filter.role ? null : query(root));

  await assert.rejects(
    () => provisionRootUser(),
    /Configured ROOT account must be ACTIVE/,
  );
  assert.equal(root.status, 'SUSPENDED');
});
