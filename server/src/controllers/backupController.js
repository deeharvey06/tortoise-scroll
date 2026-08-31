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
  ['journalEntries', JournalEntry],
  ['backtestConfigs', BacktestConfig],
  ['aiMemories', AIMemory],
  ['aiConversations', AIConversation],
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

export async function exportAll(req, res) {
  const data = {};
  for (const [key, Model] of COLLECTIONS_IN_ORDER) {
    data[key] = await Model.find().lean();
  }

  // AI settings are included so the provider/model choice round-trips, but
  // the API key is never written to a portable backup file.
  const aiSettings = await AISettings.findOne().lean();
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
  } catch (err) {
    res.status(400);
    throw err;
  }

  const report = [];

  for (const [key, Model] of COLLECTIONS_IN_ORDER) {
    const docs = backup.data[key];
    if (!Array.isArray(docs)) continue; // key absent from this backup — leave that collection untouched
    try {
      await Model.deleteMany({});
      if (docs.length > 0) {
        await Model.insertMany(docs, { ordered: false });
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
      await AISettings.deleteMany({});
      await AISettings.create({ ...rest, openaiApiKey: '' });
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
