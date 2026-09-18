import mongoose from 'mongoose';
const instrumentSpecificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    assetType: {
      type: String,
      enum: ['equity', 'option', 'future', 'forex', 'crypto', 'other'],
      required: true,
    },
    tickSize: { type: Number, default: null, min: 0.00000001 },
    tickValue: { type: Number, default: null, min: 0.00000001 },
    pointValue: { type: Number, default: null, min: 0.00000001 },
    contractMultiplier: { type: Number, required: true, min: 0.00000001 },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
      trim: true,
      match: /^[A-Z]{3}$/,
    },
    exchange: { type: String, default: '', trim: true },
    timezone: { type: String, default: 'America/New_York', trim: true },
    session: {
      type: String,
      enum: ['rth', 'eth', '24x5', '24x7', 'custom', 'unspecified'],
      default: 'unspecified',
    },
    sessionOpen: { type: String, default: '' },
    sessionClose: { type: String, default: '' },
    source: { type: String, enum: ['system', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
instrumentSpecificationSchema.index(
  { userId: 1, symbol: 1, assetType: 1 },
  { unique: true }
);
export default mongoose.model(
  'InstrumentSpecification',
  instrumentSpecificationSchema
);
