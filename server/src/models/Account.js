import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    broker: { type: String, trim: true, default: '' },
    currency: { type: String, default: 'USD' },
    startingBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model('Account', accountSchema);
