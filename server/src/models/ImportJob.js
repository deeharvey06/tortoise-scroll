import mongoose from 'mongoose';

/**
 * Records the outcome of a CSV import. Processing itself happens
 * synchronously within the request (appropriate for a local personal app
 * and typical broker export sizes); this document is the permanent audit
 * trail of what was imported, skipped, or failed, and why. Never silently
 * discard a row — every row's fate is captured in `rows`.
 */
const importJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    broker: { type: String, default: 'generic' },
    originalFilename: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    mode: { type: String, enum: ['trade', 'execution'], default: 'trade' },
    reconstructionPolicy: { type: String, enum: ['fifo'], default: 'fifo' },
    sourceTimezone: { type: String, default: '' },
    mapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: {
      totalRows: { type: Number, default: 0 },
      imported: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
      executionsDetected: { type: Number, default: 0 },
      executionsImported: { type: Number, default: 0 },
      tradesReconstructed: { type: Number, default: 0 },
      tradesUpdated: { type: Number, default: 0 },
      openPositions: { type: Number, default: 0 },
      warnings: { type: Number, default: 0 },
      rejectedRows: { type: Number, default: 0 },
    },
    rows: [
      {
        rowNumber: Number,
        outcome: {
          type: String,
          enum: [
            'imported',
            'execution_imported',
            'duplicate',
            'warning',
            'error',
          ],
        },
        message: String,
        executionKey: { type: String, default: '' },
        field: { type: String, default: undefined },
        value: { type: mongoose.Schema.Types.Mixed, default: undefined },
        tradeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Trade',
          default: null,
        },
      },
    ],
  },
  { timestamps: true }
);

importJobSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ImportJob', importJobSchema);
