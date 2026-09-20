import fs from 'node:fs/promises';
import { createReadStream, createWriteStream, constants } from 'node:fs';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import logger from '../config/logger.js';

function keyBytes(key) {
  const value = Buffer.from(key || '', 'base64');
  if (value.length !== 32 || value.toString('base64') !== key)
    throw new Error(
      'BACKUP_ENCRYPTION_KEY must be a base64 encoded 32-byte key'
    );
  return value;
}
function databaseName(uri) {
  const name = /^mongodb(?:\+srv)?:\/\/[^/]+\/([A-Za-z0-9_-]+)(?:\?|$)/.exec(
    uri || ''
  )?.[1];
  if (!name) throw new Error('An explicit database name is required');
  return name;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function encrypt(source, target, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  await fs.writeFile(target, iv, { flag: 'wx', mode: 0o600 });
  await pipeline(
    createReadStream(source),
    cipher,
    createWriteStream(target, { flags: 'a', mode: 0o600 })
  );
  await fs.appendFile(target, cipher.getAuthTag());
}
async function decrypt(source, target, key) {
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 28)
    throw new Error('Invalid encrypted artifact');
  const handle = await fs.open(source, 'r');
  const iv = Buffer.alloc(12),
    tag = Buffer.alloc(16);
  try {
    await handle.read(iv, 0, 12, 0);
    await handle.read(tag, 0, 16, stat.size - 16);
  } finally {
    await handle.close();
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  await pipeline(
    stat.size === 28
      ? Readable.from([])
      : createReadStream(source, { start: 12, end: stat.size - 17 }),
    decipher,
    createWriteStream(target, { flags: 'wx', mode: 0o600 })
  );
}
async function tool(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', () =>
      reject(new Error('Database recovery tool unavailable'))
    );
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Database recovery tool failed'))
    );
  });
}
async function* files(root, relative = '') {
  for (const entry of await fs.readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('Symlinks are not permitted in recovery sources');
    if (entry.isDirectory()) yield* files(root, name);
    else if (entry.isFile()) yield name;
    else throw new Error('Unsupported recovery source file');
  }
}
async function emptyDirectory(root) {
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  if (!(await fs.lstat(root)).isDirectory() || (await fs.readdir(root)).length)
    throw new Error('Restore directories must be empty regular directories');
}
const validRelative = (name) =>
  typeof name === 'string' &&
  name.length > 0 &&
  !path.isAbsolute(name) &&
  !name.includes('\\') &&
  name.split('/').every((part) => part && part !== '.' && part !== '..');
const connect = async (uri) => {
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  return client;
};
async function counts(db) {
  const result = {};
  for (const entry of await db
    .listCollections({}, { nameOnly: true })
    .toArray())
    result[entry.name] = await db.collection(entry.name).countDocuments();
  return result;
}

/** Maintenance-only backup: callers must stop ALL writers, including schedulers.
 * Encrypted artifacts include the entire app DB, originals, and optional local data.
 */
export async function createRecoveryBackup({
  uri,
  roots,
  destination,
  encryptionKey,
  maintenanceConfirmed,
}) {
  if (!maintenanceConfirmed)
    throw new Error('Stop all writers and confirm maintenance before backup');
  const key = keyBytes(encryptionKey),
    sourceDb = databaseName(uri);
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'tortoise-backup-'));
  let client;
  logger.info({
    event: 'RECOVERY_BACKUP_STARTED',
    component: 'backup',
    outcome: 'started',
  });
  try {
    for (const [name, root] of Object.entries(roots)) {
      if (!['uploads', 'marketData'].includes(name))
        throw new Error('Unsupported recovery root');
      if (!(await fs.lstat(root)).isDirectory())
        throw new Error('Recovery source must be a regular directory');
      const real = await fs.realpath(root);
      for (const target of [destination, stage])
        if (
          path.resolve(target) === real ||
          path.resolve(target).startsWith(real + path.sep)
        )
          throw new Error('Backup output must be outside source directories');
    }
    if (!roots.uploads) throw new Error('Uploads source is required');
    await fs.mkdir(destination, { mode: 0o700 }); // Refuse an existing artifact.
    await fs.mkdir(path.join(destination, 'files'), { mode: 0o700 });
    const configFile = path.join(stage, 'mongo.json');
    await fs.writeFile(configFile, JSON.stringify({ uri }), { mode: 0o600 });
    client = await connect(uri);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      sourceDb,
      collections: await counts(client.db(sourceDb)),
      roots: Object.keys(roots),
      files: [],
    };
    const dump = path.join(stage, 'database.archive');
    await tool('mongodump', [
      `--config=${configFile}`,
      `--archive=${dump}`,
      '--gzip',
      '--quiet',
    ]);
    await fs.chmod(dump, 0o600);
    manifest.databaseSha256 = await digest(dump);
    await encrypt(dump, path.join(destination, 'database.enc'), key);
    for (const [rootName, root] of Object.entries(roots))
      for await (const relative of files(root)) {
        const source = path.join(root, relative),
          artifact = `${manifest.files.length}.enc`;
        if (!validRelative(relative.split(path.sep).join('/')))
          throw new Error('Invalid source path');
        const sha256 = await digest(source);
        await encrypt(source, path.join(destination, 'files', artifact), key);
        manifest.files.push({
          root: rootName,
          path: relative.split(path.sep).join('/'),
          artifact,
          sha256,
        });
      }
    const manifestFile = path.join(stage, 'manifest.json');
    await fs.writeFile(manifestFile, JSON.stringify(manifest), { mode: 0o600 });
    await encrypt(manifestFile, path.join(destination, 'manifest.enc'), key);
    logger.info({
      event: 'RECOVERY_BACKUP_COMPLETED',
      component: 'backup',
      outcome: 'success',
      count: manifest.files.length,
    });
    return {
      success: true,
      files: manifest.files.length,
      collections: Object.keys(manifest.collections).length,
    };
  } catch (error) {
    logger.error({
      event: 'RECOVERY_BACKUP_FAILED',
      component: 'backup',
      outcome: 'failure',
    });
    throw error;
  } finally {
    await client?.close();
    await fs.rm(stage, { recursive: true, force: true });
  }
}
export async function restoreRecoveryBackup({
  uri,
  roots,
  source,
  encryptionKey,
  maintenanceConfirmed,
}) {
  if (!maintenanceConfirmed)
    throw new Error(
      'Restore requires maintenance confirmation and empty targets'
    );
  const key = keyBytes(encryptionKey),
    targetDb = databaseName(uri);
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'tortoise-restore-'));
  let client;
  logger.info({
    event: 'RECOVERY_RESTORE_STARTED',
    component: 'backup',
    outcome: 'started',
  });
  try {
    const manifestFile = path.join(stage, 'manifest.json');
    await decrypt(path.join(source, 'manifest.enc'), manifestFile, key);
    const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    if (
      manifest.version !== 1 ||
      !/^[A-Za-z0-9_-]+$/.test(manifest.sourceDb) ||
      !Array.isArray(manifest.files) ||
      !Array.isArray(manifest.roots) ||
      !manifest.roots.includes('uploads')
    )
      throw new Error('Invalid recovery manifest');
    const seen = new Set();
    for (const name of manifest.roots)
      if (!['uploads', 'marketData'].includes(name) || !roots[name])
        throw new Error('Missing recovery target directory');
    for (const file of manifest.files) {
      const id = `${file.root}/${file.path}`;
      if (
        !manifest.roots.includes(file.root) ||
        !validRelative(file.path) ||
        !/^\d+\.enc$/.test(file.artifact) ||
        !/^[a-f0-9]{64}$/.test(file.sha256) ||
        seen.has(id)
      )
        throw new Error('Invalid recovery file path');
      seen.add(id);
      const output = path.join(stage, file.artifact);
      await decrypt(path.join(source, 'files', file.artifact), output, key);
      if ((await digest(output)) !== file.sha256)
        throw new Error('Recovery file integrity failed');
    }
    const dump = path.join(stage, 'database.archive');
    await decrypt(path.join(source, 'database.enc'), dump, key);
    if ((await digest(dump)) !== manifest.databaseSha256)
      throw new Error('Database integrity failed');
    client = await connect(uri);
    const db = client.db(targetDb);
    if ((await db.listCollections({}, { nameOnly: true }).toArray()).length)
      throw new Error('Restore database must be empty');
    for (const name of manifest.roots) await emptyDirectory(roots[name]);
    const configFile = path.join(stage, 'mongo.json');
    // A database in mongorestore's URI becomes a namespace include filter,
    // which would exclude the old namespace before --nsFrom/--nsTo mapping.
    let restoreUri = uri.replace(
      /^(mongodb(?:\+srv)?:\/\/[^/]+)\/[A-Za-z0-9_-]+(?=\?|$)/,
      '$1/'
    );
    if (uri.includes('@') && !/[?&]authSource=/.test(uri))
      restoreUri += `${restoreUri.includes('?') ? '&' : '?'}authSource=${encodeURIComponent(client.options.credentials?.source || targetDb)}`;
    await fs.writeFile(configFile, JSON.stringify({ uri: restoreUri }), {
      mode: 0o600,
    });
    await tool('mongorestore', [
      `--config=${configFile}`,
      `--archive=${dump}`,
      '--gzip',
      '--quiet',
      '--stopOnError',
      `--nsFrom=${manifest.sourceDb}.*`,
      `--nsTo=${targetDb}.*`,
    ]);
    const restored = await counts(db);
    if (
      JSON.stringify(Object.entries(restored).sort()) !==
      JSON.stringify(Object.entries(manifest.collections).sort())
    )
      throw new Error('Restored collection counts differ');
    for (const file of manifest.files) {
      const output = path.join(roots[file.root], file.path);
      await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
      await fs.copyFile(
        path.join(stage, file.artifact),
        output,
        constants.COPYFILE_EXCL
      );
      await fs.chmod(output, 0o600);
    }
    // Never revive old sessions or outstanding reset links after recovery.
    for (const name of [
      'sessions',
      'sessionrecords',
      'passwordresettokens',
      'rateLimitBuckets',
    ])
      await db.collection(name).deleteMany({});
    await db
      .collection('users')
      .updateMany({}, { $inc: { sessionVersion: 1 } });
    logger.info({
      event: 'RECOVERY_RESTORE_COMPLETED',
      component: 'backup',
      outcome: 'success',
      count: manifest.files.length,
    });
    return {
      success: true,
      files: manifest.files.length,
      sessionsInvalidated: true,
    };
  } catch (error) {
    logger.error({
      event: 'RECOVERY_RESTORE_FAILED',
      component: 'backup',
      outcome: 'failure',
    });
    throw error;
  } finally {
    await client?.close();
    await fs.rm(stage, { recursive: true, force: true });
  }
}
