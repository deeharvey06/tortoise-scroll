import mongoose from 'mongoose';

const journalEntrySchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null, index: true },
    type: {
      type: String,
      enum: ['pre-market', 'daily', 'post-market', 'weekly', 'monthly', 'freeform'],
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // the trading day/period this entry covers
    title: { type: String, default: '' },
    content: { type: String, default: '' }, // plain text / markdown
    relatedTrades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Trade' }],
  },
  { timestamps: true }
);

journalEntrySchema.index({ type: 1, date: -1 });

export default mongoose.model('JournalEntry', journalEntrySchema);
