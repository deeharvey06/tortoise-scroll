import mongoose from 'mongoose';

const brokerSyncRunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerConnection',
      required: true,
      index: true,
    },
    provider: { type: String, required: true, lowercase: true },
    syncType: {
      type: String,
      enum: ['initial', 'incremental', 'manual', 'reconnect'],
      required: true,
    },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    summary: {
      accountsDiscovered: { type: Number, default: 0 },
      recordsFetched: { type: Number, default: 0 },
      executionsInserted: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      tradesReconstructed: { type: Number, default: 0 },
      tradesUpdated: { type: Number, default: 0 },
      openPositions: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
      rejectedRecords: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    warnings: [{ type: String }],
    errors: [{ type: String }],
    checkpointBefore: { type: mongoose.Schema.Types.Mixed, default: {} },
    checkpointAfter: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

brokerSyncRunSchema.index({ userId: 1, connectionId: 1, createdAt: -1 });
export default mongoose.model('BrokerSyncRun', brokerSyncRunSchema);
