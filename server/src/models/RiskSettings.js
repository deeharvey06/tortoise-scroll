import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * One settings document per account, or a single global one when accountId
 * is null. The Risk dashboard reads whichever applies to the account
 * currently in the filter bar, falling back to the global settings.
 */
const riskSettingsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    maxDailyLoss: { type: Number, default: null },
    maxWeeklyLoss: { type: Number, default: null },
    maxPositionSize: { type: Number, default: null },
    maxTradesPerDay: { type: Number, default: null },
    maxConsecutiveLosses: { type: Number, default: null },
    maxRiskPerTrade: { type: Number, default: null },
  },
  { timestamps: true }
);

riskSettingsSchema.index({ userId: 1, accountId: 1 }, { unique: true });

export default mongoose.model('RiskSettings', riskSettingsSchema);
