import mongoose from 'mongoose';

const { Schema } = mongoose;

const eventSchema = new Schema({
  kind: { type: String, enum: ['decision', 'note', 'line'], required: true },
  cursor: { type: Number, required: true },
  timestamp: { type: String, required: true },
  recordedAt: { type: Date, default: Date.now },
  afterExposure: { type: Boolean, required: true },
  action: { type: String, enum: ['Long', 'Short', 'Wait'] },
  confidence: { type: Number, min: 1, max: 5 },
  text: { type: String, maxlength: 2000 },
  lineType: { type: String, enum: ['level', 'stop', 'target', 'trend'] },
  price: Number,
  endPrice: Number,
  startCursor: Number,
  endCursor: Number,
});

const screenshotSchema = new Schema(
  {
    id: { type: String, required: true },
    cursor: { type: Number, required: true },
    timestamp: { type: String, required: true },
    caption: { type: String, maxlength: 200 },
  },
  { _id: false }
);

const replayRunSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, maxlength: 120 },
    mode: { type: String, enum: ['review', 'blind'], required: true },
    marketRequest: { type: Schema.Types.Mixed, required: true },
    sourceRevision: { type: String, required: true },
    dataset: { type: Schema.Types.Mixed, required: true },
    barCount: { type: Number, required: true },
    cursor: { type: Number, default: -1 },
    maxCursor: { type: Number, default: -1 },
    version: { type: Number, default: 0 },
    revealed: { type: Boolean, default: false },
    historicalTrades: {
      type: [Schema.Types.Mixed],
      default: [],
      select: false,
    },
    events: { type: [eventSchema], default: [] },
    screenshots: { type: [screenshotSchema], default: [] },
  },
  { timestamps: true }
);

replayRunSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('ReplayRun', replayRunSchema);
