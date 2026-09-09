import Account from '../models/Account.js';
import Trade from '../models/Trade.js';
import Strategy from '../models/Strategy.js';
import Playbook from '../models/Playbook.js';
import Tag from '../models/Tag.js';
import JournalEntry from '../models/JournalEntry.js';
import RiskSettings from '../models/RiskSettings.js';
import BacktestConfig from '../models/BacktestConfig.js';
import TaggingRule from '../models/TaggingRule.js';
import AIMemory from '../models/AIMemory.js';
import AIConversation from '../models/AIConversation.js';
import AISettings from '../models/AISettings.js';
import ImportJob from '../models/ImportJob.js';
import AppSettings from '../models/AppSettings.js';

const BACKUP_VERSION = 1;

// Order matters for restore: parents before children, so ObjectId
// references (Trade.accountId, Trade.strategy, etc.) resolve correctly.
// Each entry maps the backup JSON key to its Mongoose model.
const COLLECTIONS_IN_ORDER = [
  ['accounts', Account],
  ['strategies', Strategy],
  ['playbooks', Playbook],
  ['tags', Tag],
  ['taggingRules', TaggingRule],
  ['riskSettings', RiskSettings],
  ['trades', Trade],
  ['importJobs', ImportJob],
  ['journalEntries', JournalEntry],
  ['backtestConfigs', BacktestConfig],
  ['aiConversations', AIConversation],
  ['aiMemories', AIMemory],
  ['appSettings', AppSettings],
];

export function validateBackupRequest(backup) {
  if (!backup || !backup.data || typeof backup.data !== 'object') {
    throw new Error(
      'Invalid backup file: expected a { version, data } object as exported by this app.',
    );
  }
  if (!backup.confirm) {
    throw new Error(
      'Restore requires explicit confirmation (confirm: true) since it replaces existing data.',
    );
  }
}

const id = (value) => (value == null ? null : String(value));

async function allowedIds(backup, key, Model, userId) {
  if (Array.isArray(backup.data[key])) {
    return new Set(backup.data[key].map((doc) => id(doc._id)).filter(Boolean));
  }
  return new Set(
    (await Model.find({ userId }).select('_id').lean()).map((doc) => id(doc._id)),
  );
}

/**
 * Reject cross-owner and dangling references before restore deletes or inserts
 * anything. Collections present in the backup may reference only IDs restored
 * by that same backup; omitted collections may reference only the caller's
 * existing records.
 */
export async function validateBackupRelationships(backup, userId) {
  const allowed = {
    accounts: await allowedIds(backup, 'accounts', Account, userId),
    strategies: await allowedIds(backup, 'strategies', Strategy, userId),
    playbooks: await allowedIds(backup, 'playbooks', Playbook, userId),
    trades: await allowedIds(backup, 'trades', Trade, userId),
    importJobs: await allowedIds(backup, 'importJobs', ImportJob, userId),
    aiConversations: await allowedIds(backup, 'aiConversations', AIConversation, userId),
  };
  const requireAllowed = (collection, documentId, field, value, target, optional = false) => {
    if (value == null && optional) return;
    if (!allowed[target].has(id(value))) {
      throw new Error(`Invalid backup relationship: ${collection}.${id(documentId) || '<new>'}.${field}`);
    }
  };

  for (const trade of backup.data.trades || []) {
    requireAllowed('trades', trade._id, 'accountId', trade.accountId, 'accounts');
    requireAllowed('trades', trade._id, 'strategy', trade.strategy, 'strategies', true);
    requireAllowed('trades', trade._id, 'playbook', trade.playbook, 'playbooks', true);
    requireAllowed('trades', trade._id, 'importBatchId', trade.importBatchId, 'importJobs', true);
  }
  for (const entry of backup.data.journalEntries || []) {
    requireAllowed('journalEntries', entry._id, 'accountId', entry.accountId, 'accounts', true);
    for (const tradeId of entry.relatedTrades || []) {
      requireAllowed('journalEntries', entry._id, 'relatedTrades', tradeId, 'trades');
    }
  }
  for (const settings of backup.data.riskSettings || []) {
    requireAllowed('riskSettings', settings._id, 'accountId', settings.accountId, 'accounts', true);
  }
  for (const settings of backup.data.appSettings || []) {
    requireAllowed('appSettings', settings._id, 'defaultAccountId', settings.defaultAccountId, 'accounts', true);
    requireAllowed('appSettings', settings._id, 'defaultStrategyId', settings.defaultStrategyId, 'strategies', true);
  }
  for (const memory of backup.data.aiMemories || []) {
    requireAllowed('aiMemories', memory._id, 'sourceConversationId', memory.sourceConversationId, 'aiConversations', true);
  }
  for (const job of backup.data.importJobs || []) {
    requireAllowed('importJobs', job._id, 'accountId', job.accountId, 'accounts');
    for (const row of job.rows || []) {
      requireAllowed('importJobs', job._id, 'rows.tradeId', row.tradeId, 'trades', true);
    }
  }
}

export async function exportAll(req, res) {
  const data = {};
  for (const [key, Model] of COLLECTIONS_IN_ORDER) {
    data[key] = await Model.find({ userId: req.user.id }).lean();
  }

  // AI settings are included so the provider/model choice round-trips, but
  // the API key is never written to a portable backup file.
  const aiSettings = await AISettings.findOne({ userId: req.user.id }).lean();
  data.aiSettings = aiSettings ? { ...aiSettings, openaiApiKey: '' } : null;

  const payload = {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    note:
      'Screenshot/media image files are NOT included in this JSON export — only their metadata (captions, URLs). ' +
      'Back up the server/uploads folder separately to preserve the actual image files. ' +
      'The OpenAI API key (if any) is redacted and must be re-entered after restore.',
    data,
  };

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="trading-journal-backup-${Date.now()}.json"`,
  );
  res.json(payload);
}

export async function importAll(req, res) {
  const backup = req.body;
  try {
    validateBackupRequest(backup);
    await validateBackupRelationships(backup, req.user.id);
  } catch (err) {
    res.status(400);
    throw err;
  }

  const report = [];

  for (const [key, Model] of COLLECTIONS_IN_ORDER) {
    const docs = backup.data[key];
    if (!Array.isArray(docs)) continue; // key absent from this backup — leave that collection untouched
    try {
      await Model.deleteMany({ userId: req.user.id });
      if (docs.length > 0) {
        await Model.insertMany(docs.map(({ userId: _ignored, ...doc }) => ({ ...doc, userId: req.user.id })), { ordered: false });
      }
      report.push({ collection: key, restored: docs.length, error: null });
    } catch (err) {
      report.push({ collection: key, restored: 0, error: err.message });
    }
  }

  // AI settings restored last and only if present; API key is never
  // restored from a backup (it was redacted on export) — provider/model
  // choice comes back, but the key must be re-entered.
  if (backup.data.aiSettings) {
    try {
      const { _id, ...rest } = backup.data.aiSettings;
      await AISettings.deleteMany({ userId: req.user.id });
      await AISettings.create({ ...rest, userId: req.user.id, openaiApiKey: '' });
      report.push({ collection: 'aiSettings', restored: 1, error: null });
    } catch (err) {
      report.push({
        collection: 'aiSettings',
        restored: 0,
        error: err.message,
      });
    }
  }

  const failed = report.filter((r) => r.error);
  res.json({
    success: failed.length === 0,
    report,
    warning:
      failed.length > 0
        ? `${failed.length} collection(s) failed to restore fully — see the report for details. Nothing was silently skipped.`
        : null,
  });
}

export default { exportAll, importAll };
