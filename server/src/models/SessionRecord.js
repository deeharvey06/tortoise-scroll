import mongoose from 'mongoose';

const sessionRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: { type: String, required: true, unique: true, select: false },
  createdAt: { type: Date, default: Date.now, immutable: true },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
});

sessionRecordSchema.index({ userId: 1, lastSeenAt: -1 });

export default mongoose.models.SessionRecord ||
  mongoose.model('SessionRecord', sessionRecordSchema);
