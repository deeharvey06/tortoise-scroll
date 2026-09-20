import mongoose from 'mongoose';
import { SOURCE_TYPES } from '../services/knowledge/schema.js';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    location: String,
    checksum: { type: String, required: true },
    textChecksum: String,
    incomplete: { type: Boolean, default: false },
    format: { type: String, enum: ['pdf', 'txt'], required: true },
    extractionStatus: {
      type: String,
      enum: ['extracted', 'needs_review'],
      default: 'needs_review',
    },
    warnings: [String],
    sections: [
      { _id: false, id: String, page: Number, heading: String, text: String },
    ],
  },
  { timestamps: true }
);
schema.index(
  { userId: 1, checksum: 1, sourceType: 1, location: 1 },
  { unique: true }
);
export default mongoose.model('KnowledgeSource', schema);
