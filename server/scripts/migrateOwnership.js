import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User, { normalizeEmail } from '../src/models/User.js';
import Account from '../src/models/Account.js';
import Trade from '../src/models/Trade.js';
import JournalEntry from '../src/models/JournalEntry.js';
import Strategy from '../src/models/Strategy.js';
import Playbook from '../src/models/Playbook.js';
import Tag from '../src/models/Tag.js';
import TaggingRule from '../src/models/TaggingRule.js';
import ImportJob from '../src/models/ImportJob.js';
import RiskSettings from '../src/models/RiskSettings.js';
import BacktestConfig from '../src/models/BacktestConfig.js';
import AIConversation from '../src/models/AIConversation.js';
import AIMemory from '../src/models/AIMemory.js';
import AISettings from '../src/models/AISettings.js';
import AppSettings from '../src/models/AppSettings.js';

export const OWNED_MODELS = { Account, Trade, JournalEntry, Strategy, Playbook, Tag, TaggingRule, ImportJob, RiskSettings, BacktestConfig, AIConversation, AIMemory, AISettings, AppSettings };

const unowned = { $or: [{ userId: { $exists: false } }, { userId: null }] };

export async function repairLegacyRelationships(rootId) {
  const settings = await RiskSettings.find({ userId: rootId, accountId: { $ne: null } })
    .select('_id accountId')
    .lean();
  const accountIds = [...new Set(settings.map((row) => String(row.accountId)).filter(Boolean))];
  const ownedAccountIds = accountIds.length
    ? new Set((await Account.find({ _id: { $in: accountIds }, userId: rootId }).select('_id').lean()).map((row) => String(row._id)))
    : new Set();
  const dangling = settings.filter((row) => !ownedAccountIds.has(String(row.accountId)));
  if (!dangling.length) return { riskSettingsAccountIdCleared: 0 };

  const globalCount = await RiskSettings.countDocuments({
    userId: rootId,
    $or: [{ accountId: null }, { accountId: { $exists: false } }],
  });
  if (dangling.length !== 1 || globalCount !== 0) {
    throw new Error(
      `Cannot safely normalize dangling RiskSettings.accountId: dangling=${dangling.length}, existingGlobal=${globalCount}`,
    );
  }
  const result = await RiskSettings.updateOne(
    { _id: dangling[0]._id, userId: rootId, accountId: dangling[0].accountId },
    { $set: { accountId: null } },
  );
  if (result.modifiedCount !== 1) throw new Error('RiskSettings relationship repair did not modify exactly one record');
  return { riskSettingsAccountIdCleared: 1 };
}

async function brokenReferences(rootId) {
  const checks = [
    ['Trade.accountId', Trade, 'accountId', Account, false], ['Trade.strategy', Trade, 'strategy', Strategy, true],
    ['Trade.playbook', Trade, 'playbook', Playbook, true], ['Trade.importBatchId', Trade, 'importBatchId', ImportJob, true],
    ['JournalEntry.accountId', JournalEntry, 'accountId', Account, true], ['RiskSettings.accountId', RiskSettings, 'accountId', Account, true],
    ['AppSettings.defaultAccountId', AppSettings, 'defaultAccountId', Account, true], ['AppSettings.defaultStrategyId', AppSettings, 'defaultStrategyId', Strategy, true],
    ['AIMemory.sourceConversationId', AIMemory, 'sourceConversationId', AIConversation, true],
  ];
  const results = {};
  for (const [label, source, field, target, optional] of checks) {
    const rows = await source.find({ userId: rootId, ...(optional ? { [field]: { $ne: null } } : {}) }).select(field).lean();
    const ids = rows.map((row) => row[field]).filter(Boolean);
    const ownedIds = ids.length ? new Set((await target.find({ _id: { $in: ids }, userId: rootId }).select('_id').lean()).map((row) => String(row._id))) : new Set();
    const matching = ids.filter((id) => ownedIds.has(String(id))).length;
    results[label] = { references: ids.length, matching, broken: ids.length - matching };
  }
  const journalRows = await JournalEntry.find({ userId: rootId }).select('relatedTrades').lean();
  const relatedTradeIds = journalRows.flatMap((row) => row.relatedTrades || []);
  const ownedTradeIds = relatedTradeIds.length ? new Set((await Trade.find({ _id: { $in: relatedTradeIds }, userId: rootId }).select('_id').lean()).map((row) => String(row._id))) : new Set();
  const journalMatching = relatedTradeIds.filter((id) => ownedTradeIds.has(String(id))).length;
  results['JournalEntry.relatedTrades'] = { references: relatedTradeIds.length, matching: journalMatching, broken: relatedTradeIds.length - journalMatching };
  const jobs = await ImportJob.find({ userId: rootId }).select('rows.tradeId').lean();
  const jobTradeIds = jobs.flatMap((job) => job.rows || []).map((row) => row.tradeId).filter(Boolean);
  const ownedJobTradeIds = jobTradeIds.length ? new Set((await Trade.find({ _id: { $in: jobTradeIds }, userId: rootId }).select('_id').lean()).map((row) => String(row._id))) : new Set();
  const jobMatching = jobTradeIds.filter((id) => ownedJobTradeIds.has(String(id))).length;
  results['ImportJob.rows.tradeId'] = { references: jobTradeIds.length, matching: jobMatching, broken: jobTradeIds.length - jobMatching };
  return results;
}

export async function migrateOwnership() {
  const rootEmail = normalizeEmail(process.env.ROOT_USER_EMAIL);
  if (!rootEmail) throw new Error('ROOT_USER_EMAIL is required');
  const roots = await User.find({ role: 'ROOT' }).lean();
  if (roots.length !== 1 || roots[0].emailNormalized !== rootEmail || roots[0].status !== 'ACTIVE') throw new Error('Exactly one active configured ROOT account is required');
  const rootId = roots[0]._id;
  const before = {}; const updated = {}; const after = {}; const ownership = {};
  for (const [name, Model] of Object.entries(OWNED_MODELS)) before[name] = await Model.countDocuments({});
  for (const [name, Model] of Object.entries(OWNED_MODELS)) updated[name] = (await Model.updateMany(unowned, { $set: { userId: rootId } })).modifiedCount;
  for (const [name, Model] of Object.entries(OWNED_MODELS)) {
    after[name] = await Model.countDocuments({});
    ownership[name] = { root: await Model.countDocuments({ userId: rootId }), unowned: await Model.countDocuments(unowned) };
    if (before[name] !== after[name]) throw new Error(`${name} count changed during ownership migration`);
    if (ownership[name].unowned !== 0) throw new Error(`${name} still contains unowned records`);
  }
  const repairs = await repairLegacyRelationships(rootId);
  const relationships = await brokenReferences(rootId);
  const broken = Object.entries(relationships).filter(([, value]) => value.broken > 0);
  if (broken.length) throw new Error(`Ownership relationship verification failed: ${broken.map(([name, value]) => `${name}=${value.broken}`).join(', ')}`);
  const indexes = {};
  for (const [name, Model] of Object.entries(OWNED_MODELS)) indexes[name] = await Model.syncIndexes();
  return { rootUserId: String(rootId), rootEmail, before, updated, after, ownership, repairs, relationships, indexes, dataDeleted: false };
}

if (process.argv[1] && process.argv[1].endsWith('migrateOwnership.js')) {
  try { await connectDB(); console.log(JSON.stringify(await migrateOwnership(), null, 2)); }
  finally { await mongoose.disconnect(); }
}
