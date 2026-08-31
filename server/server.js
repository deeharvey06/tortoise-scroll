import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 5050;

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[startup] Failed to connect to MongoDB:', err.message);
    console.error('[startup] Is MongoDB running? Try: mongod --dbpath <your-db-path>');
    process.exit(1);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] Trading journal API listening on http://localhost:${PORT}`);
  });
}

start();
