import mongoose from 'mongoose';

const { Schema } = mongoose;

const imageSchema = new Schema(
  { url: { type: String, required: true }, caption: { type: String, default: '' } },
  { _id: true }
);

const strategySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    market: { type: String, default: '' },
    timeframe: { type: String, default: '' },
    entryRules: { type: String, default: '' },
    exitRules: { type: String, default: '' },
    stopRules: { type: String, default: '' },
    targetRules: { type: String, default: '' },
    riskRules: { type: String, default: '' },
    notes: { type: String, default: '' },
    screenshots: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

strategySchema.index({ userId: 1, isActive: 1, name: 1 });

export default mongoose.model('Strategy', strategySchema);
