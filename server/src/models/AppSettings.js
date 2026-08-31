import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Single-document settings store for the General/Trading sections of the
 * Settings page. AI settings live in AISettings (own page), Risk limits in
 * RiskSettings (own page) — this model only holds the preferences that
 * don't have a more specific home.
 */
const appSettingsSchema = new Schema(
  {
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD' },
    defaultAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    defaultRiskAmount: { type: Number, default: null },
    defaultRMultipleTarget: { type: Number, default: null },
    defaultStrategyId: { type: Schema.Types.ObjectId, ref: 'Strategy', default: null },
    tradingHoursStart: { type: String, default: '09:30' },
    tradingHoursEnd: { type: String, default: '16:00' },
  },
  { timestamps: true }
);

export default mongoose.model('AppSettings', appSettingsSchema);
