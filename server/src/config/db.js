import mongoose from 'mongoose';
import { getConfig } from './index.js';

/**
 * Connects to MongoDB using the URI from environment variables.
 * Fails loudly on connection error rather than letting the app
 * silently run with no persistence.
 */
export async function connectDB() {
  const { mongoUri } = getConfig();

  mongoose.connection.on('connected', () => {
    console.log(`[db] Connected to MongoDB at ${mongoUri}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

export default connectDB;
