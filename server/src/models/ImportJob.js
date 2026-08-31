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
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    broker: { type: String, default: 'generic' },
    originalFilename: { type: String, default: '' },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed' },
    mapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: {
      totalRows: { type: Number, default: 0 },
      imported: { type: Number, default: 0 },
      duplicates: { type: Number, default: 0 },
      errors: { type: Number, default: 0 },
    },
    rows: [
      {
        rowNumber: Number,
        outcome: { type: String, enum: ['imported', 'duplicate', 'error'] },
        message: String,
        tradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
      },
    ],
  },
  { timestamps: true }
);

importJobSchema.index({ createdAt: -1 });

export default mongoose.model('ImportJob', importJobSchema);
