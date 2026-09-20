import logger from './logger.js';
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
    logger.info({
      event: 'DATABASE_CONNECTED',
      component: 'database',
      outcome: 'success',
    });
  });

  mongoose.connection.on('error', () => {
    logger.error({
      event: 'DATABASE_ERROR',
      component: 'database',
      outcome: 'failure',
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn({ event: 'DATABASE_DISCONNECTED', component: 'database' });
  });

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

export default connectDB;
