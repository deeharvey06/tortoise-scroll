import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureLocalEnv, isUnsafeSessionSecret } from '../scripts/ensureLocalEnv.js';

test('recognizes missing, short, and placeholder session secrets as unsafe', () => {
  assert.equal(isUnsafeSessionSecret(''), true);
  assert.equal(isUnsafeSessionSecret('short'), true);
  assert.equal(isUnsafeSessionSecret('replace-with-at-least-32-random-characters'), true);
  assert.equal(isUnsafeSessionSecret('A-real-local-secret-with-more-than-32-characters'), false);
});

test('creates a local env file with a unique secret while preserving other settings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tortoise-env-'));
  const examplePath = path.join(directory, '.env.example');
  const envPath = path.join(directory, '.env');
  fs.writeFileSync(examplePath, 'PORT=5050\nSESSION_SECRET=\nMONGO_URI=mongodb://localhost/test\n');
  const result = ensureLocalEnv({ envPath, examplePath });
  const content = fs.readFileSync(envPath, 'utf8');
  const secret = content.match(/^SESSION_SECRET=(.+)$/m)?.[1];
  assert.equal(result.changed, true);
  assert.equal(content.includes('MONGO_URI=mongodb://localhost/test'), true);
  assert.equal(isUnsafeSessionSecret(secret), false);
  assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
});

test('replaces only an unsafe secret and leaves a valid env file unchanged afterward', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tortoise-env-'));
  const envPath = path.join(directory, '.env');
  const examplePath = path.join(directory, '.env.example');
  fs.writeFileSync(examplePath, 'SESSION_SECRET=\n');
  fs.writeFileSync(envPath, 'PORT=5050\nSESSION_SECRET=change-me-please-change-me-please-change-me\nCUSTOM=value\n');
  assert.equal(ensureLocalEnv({ envPath, examplePath }).changed, true);
  const first = fs.readFileSync(envPath, 'utf8');
  assert.equal(first.includes('CUSTOM=value'), true);
  assert.equal(ensureLocalEnv({ envPath, examplePath }).changed, false);
  assert.equal(fs.readFileSync(envPath, 'utf8'), first);
});
