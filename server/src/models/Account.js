import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    broker: { type: String, trim: true, default: '' },
    accountType: {
      type: String,
      enum: ['cash', 'margin', 'futures', 'retirement', 'paper', 'other'],
      default: 'other',
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
    },
    startingBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
    tradingConfig: {
      defaultInstrumentSymbol: {
        type: String,
        default: '',
        uppercase: true,
        trim: true,
      },
      defaultTimeframe: { type: String, default: '', trim: true },
      preferredSession: {
        type: String,
        enum: [
          'pre-market',
          'open',
          'mid-day',
          'power-hour',
          'after-hours',
          'unspecified',
        ],
        default: 'unspecified',
      },
      timezone: { type: String, default: '', trim: true },
      notes: { type: String, default: '' },
    },
  },
  { timestamps: true }
);
accountSchema.index({ userId: 1, isActive: 1 });
accountSchema.index({ userId: 1, name: 1 });
export default mongoose.model('Account', accountSchema);
