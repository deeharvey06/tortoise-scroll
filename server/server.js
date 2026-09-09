import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

import { createApp } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { provisionRootUser } from './src/auth/rootProvisioning.js';
import { getConfig } from './src/config/index.js';

async function start() {
  let config;
  try {
    config = getConfig();
  } catch (err) {
    console.error('[startup] Invalid server configuration:', err.message);
    console.error('[startup] For local development, run: npm run dev');
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error('[startup] Failed to connect to MongoDB:', err.message);
    console.error(
      '[startup] Is MongoDB running? Try: mongod --dbpath <your-db-path>',
    );
    process.exit(1);
  }

  try {
    await provisionRootUser();
  } catch (err) {
    console.error(
      '[startup] Failed to provision the ROOT account:',
      err.message,
    );
    process.exit(1);
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(
      `[server] Trading journal API listening on http://localhost:${config.port}`,
    );
  });
}

start();
