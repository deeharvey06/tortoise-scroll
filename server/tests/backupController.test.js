import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBackupRequest } from '../src/controllers/backupController.js';

test('validateBackupRequest rejects missing or malformed backup data', () => {
  assert.throws(() => validateBackupRequest(null), /Invalid backup file/);
  assert.throws(
    () => validateBackupRequest({ data: [] }),
    /Restore requires explicit confirmation/,
  );
});

test('validateBackupRequest requires explicit confirmation', () => {
  assert.throws(
    () => validateBackupRequest({ data: {}, confirm: false }),
    /Restore requires explicit confirmation/,
  );
  assert.doesNotThrow(() => validateBackupRequest({ data: {}, confirm: true }));
});
