import mongoose from 'mongoose';

/**
 * Hierarchical tag: a category (Setup / Mistake / Emotion / Custom...) plus
 * a name. Trades reference tags by name string (Trade.tags: [String]) for
 * simplicity/perf at scale; this collection is the managed vocabulary so
 * the UI can group/color-code by category rather than free-typing forever.
 */
const tagSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Setup', 'Mistake', 'Emotion', 'Custom'],
      default: 'Custom',
      index: true,
    },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '' }, // hex, optional
  },
  { timestamps: true }
);

tagSchema.index({ category: 1, name: 1 }, { unique: true });

export default mongoose.model('Tag', tagSchema);
