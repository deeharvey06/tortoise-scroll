import {
  createRecoveryBackup,
  restoreRecoveryBackup,
} from '../src/operations/recovery.js';
import logger from '../src/config/logger.js';

// Credentials come from the operator's environment; never argv or console output.
const [operation, artifact] = process.argv.slice(2);
try {
  if (!['backup', 'restore'].includes(operation) || !artifact)
    throw new Error('Usage: recovery.js backup|restore ARTIFACT_DIRECTORY');
  const roots = {
    uploads: process.env.UPLOADS_DIR,
    ...(process.env.MARKET_DATA_LOCAL_ROOT
      ? { marketData: process.env.MARKET_DATA_LOCAL_ROOT }
      : {}),
  };
  if (!roots.uploads) throw new Error('UPLOADS_DIR is required');
  const common = {
    uri: process.env.MONGO_URI,
    roots,
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
    maintenanceConfirmed: process.env.RECOVERY_MAINTENANCE_CONFIRMED === 'true',
  };
  if (operation === 'backup')
    await createRecoveryBackup({ ...common, destination: artifact });
  else await restoreRecoveryBackup({ ...common, source: artifact });
} catch {
  logger.error({
    event: 'RECOVERY_COMMAND_FAILED',
    component: 'backup',
    outcome: 'failure',
  });
  process.exitCode = 1;
}
