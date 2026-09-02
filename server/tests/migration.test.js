import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Account from '../src/models/Account.js';
import RiskSettings from '../src/models/RiskSettings.js';
import { migrateOwnership, OWNED_MODELS, repairLegacyRelationships } from '../scripts/migrateOwnership.js';

test('migration preserves counts, assigns legacy data to ROOT, verifies relationships, and deletes nothing', async () => {
  const rootId = new mongoose.Types.ObjectId();
  process.env.ROOT_USER_EMAIL = 'root@example.test';
  const originals = [];
  const stub = (object, key, value) => { originals.push([object, key, object[key]]); object[key] = value; };
  stub(User, 'find', () => ({ lean: async () => [{ _id: rootId, emailNormalized: 'root@example.test', role: 'ROOT', status: 'ACTIVE' }] }));
  const state = {};
  for (const [name, Model] of Object.entries(OWNED_MODELS)) {
    state[name] = { total: 2, root: 0, unowned: 2, deleted: 0 };
    stub(Model, 'countDocuments', async (filter = {}) => filter.$or ? state[name].unowned : filter.userId ? state[name].root : state[name].total);
    stub(Model, 'updateMany', async () => { const modifiedCount = state[name].unowned; state[name].root += modifiedCount; state[name].unowned = 0; return { modifiedCount }; });
    stub(Model, 'find', () => ({ select() { return this; }, lean: async () => [] }));
    stub(Model, 'syncIndexes', async () => []);
    stub(Model, 'deleteMany', async () => { state[name].deleted += 1; throw new Error('migration must never delete'); });
  }
  try {
    const report = await migrateOwnership();
    assert.equal(report.dataDeleted, false);
    for (const name of Object.keys(OWNED_MODELS)) {
      assert.equal(report.before[name], 2); assert.equal(report.after[name], 2);
      assert.equal(report.ownership[name].root, 2); assert.equal(report.ownership[name].unowned, 0);
      assert.equal(state[name].deleted, 0);
    }
    assert.ok(Object.values(report.relationships).every((result) => result.broken === 0));
  } finally { for (const [object, key, value] of originals.reverse()) object[key] = value; }
});

test('migration preserves a dangling RiskSettings record by converting it to global settings', async () => {
  const rootId = new mongoose.Types.ObjectId();
  const settingsId = new mongoose.Types.ObjectId();
  const missingAccountId = new mongoose.Types.ObjectId();
  const originals = [[RiskSettings, 'find', RiskSettings.find], [RiskSettings, 'countDocuments', RiskSettings.countDocuments], [RiskSettings, 'updateOne', RiskSettings.updateOne], [Account, 'find', Account.find]];
  let update;
  RiskSettings.find = () => ({ select() { return this; }, lean: async () => [{ _id: settingsId, accountId: missingAccountId }] });
  Account.find = () => ({ select() { return this; }, lean: async () => [] });
  RiskSettings.countDocuments = async () => 0;
  RiskSettings.updateOne = async (filter, change) => { update = { filter, change }; return { modifiedCount: 1 }; };
  try {
    const report = await repairLegacyRelationships(rootId);
    assert.equal(report.riskSettingsAccountIdCleared, 1);
    assert.equal(String(update.filter.userId), String(rootId));
    assert.equal(String(update.filter.accountId), String(missingAccountId));
    assert.equal(update.change.$set.accountId, null);
  } finally {
    for (const [object, key, value] of originals) object[key] = value;
  }
});
