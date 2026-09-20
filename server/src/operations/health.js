import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

export async function storageHealth(root) {
  const probe = path.join(root, `.readiness-${randomUUID()}`);
  try {
    await fs.writeFile(probe, 'tortoise-storage-check', {
      flag: 'wx',
      mode: 0o600,
    });
    if ((await fs.readFile(probe, 'utf8')) !== 'tortoise-storage-check')
      throw new Error('Storage check failed');
    await fs.unlink(probe);
    return true;
  } catch {
    await fs.unlink(probe).catch(() => {});
    return false;
  }
}
export async function databaseHealth() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.command(
      { ping: 1 },
      { maxTimeMS: 1000, timeoutMS: 1500 }
    );
    return true;
  } catch {
    return false;
  }
}
async function bounded(check, timeoutMs = 2000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(check)
        .catch(() => false),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export function createReadiness({
  state,
  storageRoot,
  email,
  databaseCheck = databaseHealth,
  storageCheck = () => storageHealth(storageRoot),
}) {
  let cached,
    cachedAt = 0,
    pending;
  return async () => {
    if (state.draining)
      return { status: 'not_ready', checks: { lifecycle: 'draining' } };
    if (cached && Date.now() - cachedAt < 1000) return cached;
    if (!pending)
      pending = (async () => {
        const [db, storage, mail] = await Promise.all([
          bounded(databaseCheck),
          bounded(storageCheck),
          !email?.enabled
            ? true
            : bounded(() =>
                email.health ? email.health() : email.healthy === true
              ),
        ]);
        const ready = db && storage && mail && !state.draining;
        cached = {
          status: ready ? 'ready' : 'not_ready',
          checks: {
            database: db ? 'up' : 'down',
            storage: storage ? 'up' : 'down',
            email: mail ? 'up' : 'down',
          },
        };
        cachedAt = Date.now();
        return cached;
      })().finally(() => {
        pending = null;
      });
    return pending;
  };
}
