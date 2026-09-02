import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'USER_ROLE_CHANGED',
        'USER_STATUS_CHANGED',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET',
        'SESSION_REVOKED',
        'OTHER_SESSIONS_REVOKED',
      ],
      required: true,
      index: true,
    },
    before: { type: mongoose.Schema.Types.Mixed, required: true },
    after: { type: mongoose.Schema.Types.Mixed, required: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model('AuditLog', auditLogSchema);
