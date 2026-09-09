import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trading-journal-e2e';
let dbName;
try {
  dbName = new URL(uri).pathname.replace(/^\//, '').split('?')[0];
} catch {
  console.error('[test-db] MONGO_URI must be a valid MongoDB URI');
  process.exit(1);
}

if (!dbName || !/(^|[-_])(test|e2e)([-_]|$)/i.test(dbName)) {
  console.error(`[test-db] Refusing to drop non-test database: ${dbName || '(missing database name)'}`);
  process.exit(1);
}

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await mongoose.connection.db.dropDatabase();
  console.log(`[test-db] Reset ${dbName}`);
} catch (error) {
  console.error('[test-db] Failed to reset test database:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
