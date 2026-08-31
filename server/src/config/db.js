import mongoose from 'mongoose';

/**
 * Connects to MongoDB using the URI from environment variables.
 * Fails loudly on connection error rather than letting the app
 * silently run with no persistence.
 */
export async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trading-journal';

  mongoose.connection.on('connected', () => {
    console.log(`[db] Connected to MongoDB at ${uri}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });

  return mongoose.connection;
}

export default connectDB;
