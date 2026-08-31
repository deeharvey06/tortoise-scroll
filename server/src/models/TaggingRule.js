import mongoose from 'mongoose';

const { Schema } = mongoose;

const conditionSchema = new Schema(
  {
    field: {
      type: String,
      enum: ['setup', 'session', 'direction', 'symbol', 'assetType', 'followedPlan', 'rMultiple', 'netPnL', 'holdingTimeSeconds'],
      required: true,
    },
    operator: { type: String, enum: ['equals', 'contains', 'gt', 'gte', 'lt', 'lte'], required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const taggingRuleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    // If true, matching trades get the tags applied automatically when the
    // rule is run. If false, the rule only produces a suggestion for the
    // user to approve — per spec: "Allow the user to approve or
    // automatically apply tags."
    autoApply: { type: Boolean, default: false },
    conditions: { type: [conditionSchema], default: [] }, // ALL conditions must match (AND)
    tagsToApply: { type: [String], default: [] },
  },
  { timestamps: true }
);

taggingRuleSchema.index({ isActive: 1 });

export default mongoose.model('TaggingRule', taggingRuleSchema);
