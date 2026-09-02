import mongoose from 'mongoose';

const { Schema } = mongoose;

const backtestConfigSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    timeframe: { type: String, default: '1d' },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    direction: { type: String, enum: ['long', 'short'], default: 'long' },
    entryRule: {
      type: { type: String, enum: ['smaCrossover'], default: 'smaCrossover' },
      fastPeriod: { type: Number, default: 10 },
      slowPeriod: { type: Number, default: 30 },
    },
    stopLossPct: { type: Number, default: null },
    takeProfitPct: { type: Number, default: null },
    positionSize: { type: Number, default: 1 },
    commission: { type: Number, default: 0 },
    slippage: { type: Number, default: 0 },
    // Cached result of the last successful run, so the UI has something to
    // show without re-running against the data provider every page load.
    lastResult: { type: Schema.Types.Mixed, default: null },
    lastRunAt: { type: Date, default: null },
  },
  { timestamps: true }
);

backtestConfigSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('BacktestConfig', backtestConfigSchema);
