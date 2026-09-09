import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(scriptPath), '..');

export function isUnsafeSessionSecret(value) {
  return String(value || '').length < 32 || /replace-with|change-me|example/i.test(String(value || ''));
}

export function ensureLocalEnv({
  envPath = path.join(serverRoot, '.env'),
  examplePath = path.join(serverRoot, '.env.example'),
} = {}) {
  const source = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : fs.readFileSync(examplePath, 'utf8');
  const match = source.match(/^SESSION_SECRET=(.*)$/m);
  if (match && !isUnsafeSessionSecret(match[1].trim())) return { changed: false, envPath };

  const secret = crypto.randomBytes(48).toString('base64url');
  const next = match
    ? source.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`)
    : `${source.replace(/\s*$/, '')}\nSESSION_SECRET=${secret}\n`;
  fs.writeFileSync(envPath, next, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  return { changed: true, envPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const result = ensureLocalEnv();
  if (result.changed) console.log('[setup] Generated a unique local SESSION_SECRET in server/.env');
}
