import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A single fill/execution. A Trade can have many of these on the entry
 * side, the exit side, or both (scaling in/out). Aggregate entry/exit
 * price and quantity are derived from these in the calculations service —
 * they are never hand-entered as the source of truth once fills exist.
 */
const executionSchema = new Schema(
  {
    side: { type: String, enum: ['buy', 'sell'], required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    time: { type: Date, required: true },
    fees: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
  },
  { _id: false }
);

const screenshotSchema = new Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, default: '' },
    annotations: { type: Schema.Types.Mixed, default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const tradeSchema = new Schema(
  {
    // Identity / linkage
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    strategy: { type: Schema.Types.ObjectId, ref: 'Strategy', default: null, index: true },
    playbook: { type: Schema.Types.ObjectId, ref: 'Playbook', default: null, index: true },

    // Instrument
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    assetType: {
      type: String,
      enum: ['equity', 'option', 'future', 'forex', 'crypto', 'other'],
      default: 'equity',
    },
    market: { type: String, default: '' },

    // Direction / size
    direction: { type: String, enum: ['long', 'short'], required: true, index: true },
    quantity: { type: Number, required: true }, // net/aggregate size, derived if fills exist

    // Price / time — aggregate values. When `executions` is populated these
    // are computed (weighted avg price, first/last time); when empty they
    // are the user's direct single entry/exit.
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    entryTime: { type: Date, required: true, index: true },
    exitTime: { type: Date, default: null },

    executions: { type: [executionSchema], default: [] },

    // Risk
    stopLoss: { type: Number, default: null },
    takeProfit: { type: Number, default: null },
    riskAmount: { type: Number, default: null }, // $ risked, used for R calc

    // Costs
    fees: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },

    // Derived financials — always written by services/calculations.js,
    // never computed inline in a controller or in the UI.
    grossPnL: { type: Number, default: null },
    netPnL: { type: Number, default: null },
    rMultiple: { type: Number, default: null },
    holdingTimeSeconds: { type: Number, default: null },

    // Classification
    setup: { type: String, default: '', index: true },
    session: {
      type: String,
      enum: ['pre-market', 'open', 'mid-day', 'power-hour', 'after-hours', 'unspecified'],
      default: 'unspecified',
    },
    timeframe: { type: String, default: '' },

    // Journal / qualitative
    entryReason: { type: String, default: '' },
    exitReason: { type: String, default: '' },
    marketCondition: { type: String, default: '' },
    mistake: { type: [String], default: [] },
    emotion: { type: [String], default: [] },
    confidence: { type: Number, min: 1, max: 5, default: null },
    notes: { type: String, default: '' },
    lessonsLearned: { type: String, default: '' },

    followedPlan: { type: Boolean, default: null },
    followedRules: { type: Boolean, default: null },
    missedOpportunity: { type: Boolean, default: false },

    tags: { type: [String], default: [], index: true },
    screenshots: { type: [screenshotSchema], default: [] },
    chartImage: { type: String, default: '' },

    // Import provenance — never silently overwritten on re-import
    importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportJob', default: null },
    sourceRowHash: { type: String, default: null, index: true }, // for duplicate detection
    isDemoData: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound indexes for the query patterns the dashboard/analytics need most
tradeSchema.index({ accountId: 1, entryTime: -1 });
tradeSchema.index({ accountId: 1, symbol: 1, entryTime: -1 });
tradeSchema.index({ accountId: 1, strategy: 1 });
tradeSchema.index({ accountId: 1, tags: 1 });

export default mongoose.model('Trade', tradeSchema);
