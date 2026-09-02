import mongoose from 'mongoose';

const { Schema } = mongoose;

const imageSchema = new Schema(
  { url: { type: String, required: true }, caption: { type: String, default: '' } },
  { _id: true }
);

const CHECKLIST_DEFAULTS = [
  'Market condition correct',
  'Setup present',
  'Entry criteria satisfied',
  'Risk acceptable',
  'Stop correctly placed',
  'Target identified',
  'Trade followed plan',
];

const playbookSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    setupName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    idealConditions: { type: String, default: '' },
    entryCriteria: { type: String, default: '' },
    confirmation: { type: String, default: '' },
    invalidation: { type: String, default: '' },
    stopPlacement: { type: String, default: '' },
    target: { type: String, default: '' },
    managementRules: { type: String, default: '' },
    examples: { type: String, default: '' },
    counterexamples: { type: String, default: '' },
    checklist: { type: [String], default: CHECKLIST_DEFAULTS },
    screenshots: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

playbookSchema.index({ userId: 1, isActive: 1, setupName: 1 });

export default mongoose.model('Playbook', playbookSchema);
