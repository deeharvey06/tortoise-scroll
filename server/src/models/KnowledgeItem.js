import mongoose from 'mongoose';
import { KINDS, STATUSES } from '../services/knowledge/schema.js';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    kind: { type: String, enum: KINDS, required: true },
    dimension: String,
    classification: String,
    interpretation: String,
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    probability: { type: mongoose.Schema.Types.Mixed, default: null },
    references: [
      {
        _id: false,
        sourceId: mongoose.Schema.Types.ObjectId,
        sectionId: String,
        page: Number,
        heading: String,
        location: String,
        sourceType: String,
        text: String,
      },
    ],
    status: {
      type: String,
      enum: STATUSES,
      default: 'needs_review',
      index: true,
    },
    verifiedAt: { type: Date, default: null },
    reviewNotes: String,
    revision: { type: Number, default: 1 },
    extractionKey: String,
    history: [
      {
        _id: false,
        at: Date,
        action: String,
        note: String,
        revision: Number,
        previous: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);
schema.index(
  { userId: 1, extractionKey: 1 },
  {
    unique: true,
    partialFilterExpression: { extractionKey: { $type: 'string' } },
  }
);
schema.index({ userId: 1, status: 1, kind: 1, dimension: 1 });
export default mongoose.model('KnowledgeItem', schema);
