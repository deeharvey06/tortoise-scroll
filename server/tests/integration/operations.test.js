import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoRateLimitStore } from '../../src/operations/rateLimitStore.js';
import {
  createRecoveryBackup,
  restoreRecoveryBackup,
} from '../../src/operations/recovery.js';

const stem = `tortoise-operations-test-${process.pid}-${Date.now()}`;
const uri = (name) => `mongodb://127.0.0.1:27017/${name}`;
test(
  'real Mongo shared limiting, encrypted recovery drill and graceful process shutdown',
  { timeout: 120000 },
  async (t) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'tortoise-operations-drill-')
    );
    const client = new mongoose.mongo.MongoClient(uri(stem));
    await client.connect();
    const names = [
      stem,
      `${stem}-restored`,
      `${stem}-server`,
      `${stem}-tampered`,
    ];
    try {
      await t.test(
        'two independent limiter instances share atomic counters and expire without waiting for TTL deletion',
        async () => {
          const collection = client.db(stem).collection('rateLimitBuckets');
          await collection.createIndex(
            { resetTime: 1 },
            { expireAfterSeconds: 0 }
          );
          const a = new MongoRateLimitStore('login', () => collection),
            b = new MongoRateLimitStore('login', () => collection);
          a.init({ windowMs: 60000 });
          b.init({ windowMs: 60000 });
          const results = await Promise.all(
            Array.from({ length: 80 }, (_, i) =>
              (i % 2 ? a : b).increment('203.0.113.7')
            )
          );
          assert.deepEqual(
            results.map((v) => v.totalHits).sort((x, y) => x - y),
            Array.from({ length: 80 }, (_, i) => i + 1)
          );
          assert.equal(
            (await collection.findOne({}))._id.includes('203.0.113.7'),
            false
          );
          const separate = new MongoRateLimitStore('reset', () => collection);
          separate.init({ windowMs: 60000 });
          assert.equal((await separate.increment('203.0.113.7')).totalHits, 1);
          await collection.updateOne(
            { _id: a.key('203.0.113.7') },
            { $set: { resetTime: new Date(0) } }
          );
          assert.equal((await b.increment('203.0.113.7')).totalHits, 1);
          await a.decrement('203.0.113.7');
          assert.equal((await b.increment('203.0.113.7')).totalHits, 1);
          await a.resetKey('203.0.113.7');
          assert.equal((await b.increment('203.0.113.7')).totalHits, 1);
          await collection.deleteMany({});
        }
      );
      const sourceDb = client.db(stem),
        owner = new mongoose.Types.ObjectId(),
        account = new mongoose.Types.ObjectId();
      await sourceDb.collection('users').insertOne({
        _id: owner,
        role: 'ROOT',
        passwordHash: 'synthetic-hash',
        sessionVersion: 4,
      });
      await sourceDb
        .collection('accounts')
        .insertOne({ _id: account, userId: owner, currency: 'USD' });
      const trade = {
        _id: new mongoose.Types.ObjectId(),
        userId: owner,
        accountId: account,
        symbol: 'FIXTURE',
        netPnL: 123.45,
        entryTime: new Date('2025-01-01T00:00:00Z'),
      };
      await sourceDb.collection('trades').insertOne(trade);
      await sourceDb
        .collection('trades')
        .createIndex({ userId: 1, entryTime: -1 });
      await sourceDb
        .collection('sessions')
        .insertOne({ _id: 'synthetic-session', session: 'private-fixture' });
      await sourceDb
        .collection('passwordresettokens')
        .insertOne({ tokenHash: 'synthetic-token-hash' });
      const uploads = path.join(root, 'uploads');
      await fs.mkdir(path.join(uploads, 'knowledge'), { recursive: true });
      await fs.writeFile(
        path.join(uploads, 'knowledge', 'original.pdf'),
        Buffer.from([0, 255, 1, 2, 3])
      );
      await fs.writeFile(path.join(uploads, 'empty.txt'), '');
      const artifact = path.join(root, 'backup'),
        key = randomBytes(32).toString('base64');
      await t.test(
        'encrypted whole database and original files restore exactly, with old authentication invalidated',
        async () => {
          const backup = await createRecoveryBackup({
            uri: uri(stem),
            roots: { uploads },
            destination: artifact,
            encryptionKey: key,
            maintenanceConfirmed: true,
          });
          assert.equal(backup.success, true);
          assert.equal(backup.files, 2);
          assert.equal(
            (await fs.stat(path.join(artifact, 'database.enc'))).mode & 0o777,
            0o600
          );
          assert.equal(
            (await fs.readFile(path.join(artifact, 'manifest.enc'))).includes(
              Buffer.from('original.pdf')
            ),
            false
          );
          const restoredFiles = path.join(root, 'restored-files');
          const result = await restoreRecoveryBackup({
            uri: uri(names[1]),
            roots: { uploads: restoredFiles },
            source: artifact,
            encryptionKey: key,
            maintenanceConfirmed: true,
          });
          assert.equal(result.success, true);
          const restored = client.db(names[1]);
          assert.deepEqual(
            await restored.collection('trades').findOne({ _id: trade._id }),
            trade
          );
          assert.deepEqual(
            await restored.collection('accounts').findOne({ _id: account }),
            await sourceDb.collection('accounts').findOne({ _id: account })
          );
          assert.equal(
            (await restored.collection('users').findOne({ _id: owner }))
              .sessionVersion,
            5
          );
          assert.equal(
            await restored.collection('sessions').countDocuments(),
            0
          );
          assert.equal(
            await restored.collection('passwordresettokens').countDocuments(),
            0
          );
          assert.ok(
            (await restored.collection('trades').indexes()).some(
              (index) => index.key.userId === 1
            )
          );
          assert.deepEqual(
            await fs.readFile(
              path.join(restoredFiles, 'knowledge', 'original.pdf')
            ),
            await fs.readFile(path.join(uploads, 'knowledge', 'original.pdf'))
          );
          assert.equal(
            (await fs.readFile(path.join(restoredFiles, 'empty.txt'))).length,
            0
          );
          await assert.rejects(
            restoreRecoveryBackup({
              uri: uri(names[1]),
              roots: { uploads: restoredFiles },
              source: artifact,
              encryptionKey: key,
              maintenanceConfirmed: true,
            }),
            /must be empty/
          );
        }
      );
      await t.test(
        'wrong keys, tampering and missing maintenance approval fail before target writes',
        async () => {
          const args = {
            uri: uri(names[3]),
            roots: { uploads: path.join(root, 'tampered-target') },
            source: artifact,
            encryptionKey: key,
            maintenanceConfirmed: true,
          };
          await assert.rejects(
            restoreRecoveryBackup({ ...args, maintenanceConfirmed: false }),
            /maintenance/
          );
          await assert.rejects(
            restoreRecoveryBackup({
              ...args,
              encryptionKey: randomBytes(32).toString('base64'),
            })
          );
          const changed = path.join(root, 'changed');
          await fs.cp(artifact, changed, { recursive: true });
          const file = path.join(changed, 'database.enc'),
            bytes = await fs.readFile(file);
          bytes[15] ^= 255;
          await fs.writeFile(file, bytes);
          await assert.rejects(
            restoreRecoveryBackup({ ...args, source: changed })
          );
          assert.equal(
            (await client.db(names[3]).listCollections().toArray()).length,
            0
          );
        }
      );
      await t.test(
        'server liveness/readiness and SIGTERM resource closure work in a real child process',
        async () => {
          // No .env values may select user accounts/databases or external providers.
          const server = spawn(
            process.execPath,
            [fileURLToPath(new URL('../../server.js', import.meta.url))],
            {
              env: {
                ...process.env,
                NODE_ENV: 'test',
                PORT: '5097',
                MONGO_URI: uri(names[2]),
                SESSION_SECRET: randomBytes(32).toString('hex'),
                ROOT_USER_EMAIL: '',
                ROOT_USER_INITIAL_PASSWORD: '',
                EMAIL_PROVIDER: 'disabled',
                UPLOADS_DIR: path.join(root, 'server-uploads'),
                RATE_LIMIT_STORE: 'mongo',
                BROKER_SYNC_SCHEDULER_ENABLED: 'false',
                SHUTDOWN_TIMEOUT_MS: '5000',
              },
              stdio: ['ignore', 'pipe', 'pipe'],
            }
          );
          let logs = '';
          server.stdout.on('data', (data) => {
            logs += data;
          });
          server.stderr.on('data', (data) => {
            logs += data;
          });
          const exited = new Promise((resolve) =>
            server.once('exit', (code, signal) => resolve({ code, signal }))
          );
          try {
            let live = false;
            for (let i = 0; i < 100; i++) {
              try {
                live = (await fetch('http://127.0.0.1:5097/api/health')).ok;
              } catch {
                /* startup */
              }
              if (live) break;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            assert.equal(live, true, 'server became live');
            assert.equal(
              (await fetch('http://127.0.0.1:5097/api/ready')).status,
              200
            );
            server.kill('SIGTERM');
            let timer;
            const result = await Promise.race([
              exited,
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error('Shutdown deadline exceeded')),
                  10000
                );
              }),
            ]).finally(() => clearTimeout(timer));
            assert.equal(result.code, 0, logs);
            assert.match(logs, /SHUTDOWN_COMPLETED/);
            assert.ok(!logs.includes('mongodb://'));
          } finally {
            if (server.exitCode === null) server.kill('SIGKILL');
          }
        }
      );
    } finally {
      for (const name of names) await client.db(name).dropDatabase();
      await client.close();
      await fs.rm(root, { recursive: true, force: true });
    }
  }
);
