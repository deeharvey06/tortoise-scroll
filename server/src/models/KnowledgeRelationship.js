import mongoose from 'mongoose';
import { RELATIONS, STATUSES } from '../services/knowledge/schema.js';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    from: { type: mongoose.Schema.Types.ObjectId, required: true },
    to: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: RELATIONS, required: true },
    evidence: String,
    references: [mongoose.Schema.Types.Mixed],
    status: { type: String, enum: STATUSES, default: 'needs_review' },
    revision: { type: Number, default: 1 },
    verifiedAt: { type: Date, default: null },
    history: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);
schema.index({ userId: 1, from: 1, to: 1, type: 1 }, { unique: true });
export default mongoose.model('KnowledgeRelationship', schema);
