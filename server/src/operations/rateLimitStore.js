import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MemoryStore } from 'express-rate-limit';
import logger from '../config/logger.js';

export class MongoRateLimitStore {
  localKeys = false;
  constructor(
    namespace,
    collection = () => mongoose.connection.db.collection('rateLimitBuckets')
  ) {
    this.namespace = namespace;
    this.collection = collection;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  key(key) {
    return `${this.namespace}:${createHash('sha256').update(key).digest('hex')}`;
  }
  async increment(key) {
    const expired = {
      $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, '$$NOW'],
    };
    const update = [
      {
        $set: {
          totalHits: { $cond: [expired, 1, { $add: ['$totalHits', 1] }] },
          resetTime: {
            $cond: [expired, { $add: ['$$NOW', this.windowMs] }, '$resetTime'],
          },
        },
      },
    ];
    try {
      const collection = this.collection();
      let row;
      try {
        row = await collection.findOneAndUpdate(
          { _id: this.key(key) },
          update,
          { upsert: true, returnDocument: 'after', maxTimeMS: 2000 }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        row = await collection.findOneAndUpdate(
          { _id: this.key(key) },
          update,
          { returnDocument: 'after', maxTimeMS: 2000 }
        );
      }
      if (!row) throw new Error('Missing rate-limit bucket');
      return { totalHits: row.totalHits, resetTime: row.resetTime };
    } catch {
      logger.error({
        event: 'RATE_LIMIT_STORE_FAILED',
        component: 'limiter',
        provider: 'mongo',
        outcome: 'failure',
      });
      throw Object.assign(
        new Error('Request protection is temporarily unavailable'),
        { statusCode: 503, isOperational: true }
      );
    }
  }
  async decrement(key) {
    await this.collection().updateOne({ _id: this.key(key) }, [
      { $set: { totalHits: { $max: [0, { $subtract: ['$totalHits', 1] }] } } },
    ]);
  }
  async resetKey(key) {
    await this.collection().deleteOne({ _id: this.key(key) });
  }
}
export function createRateLimitStore(config, namespace) {
  return config.rateLimitStore === 'mongo'
    ? new MongoRateLimitStore(namespace)
    : new MemoryStore();
}
export async function initializeRateLimits(config) {
  if (config.rateLimitStore === 'mongo')
    await mongoose.connection.db
      .collection('rateLimitBuckets')
      .createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 });
}
