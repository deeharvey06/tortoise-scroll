import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Persistent memory the user (or a "remember that..." chat message)
 * explicitly asks the assistant to keep in mind across conversations —
 * e.g. stated rules, goals, or preferences. Deliberately separate from
 * Trade/Strategy/Playbook data: this is subjective context the user typed,
 * not derived from the trade log, and the user can view/delete it anytime.
 */
const aiMemorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['rule', 'goal', 'preference', 'mistake_pattern', 'other'],
      default: 'other',
    },
    sourceConversationId: { type: Schema.Types.ObjectId, ref: 'AIConversation', default: null },
  },
  { timestamps: true }
);

aiMemorySchema.index({ userId: 1, createdAt: -1 });
aiMemorySchema.index({ userId: 1, category: 1 });

export default mongoose.model('AIMemory', aiMemorySchema);
