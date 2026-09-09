import mongoose from 'mongoose';

export const USER_ROLES = Object.freeze(['USER', 'ADMIN', 'ROOT']);
export const USER_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'DISABLED']);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true },
    emailNormalized: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'USER', required: true },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'ACTIVE',
      required: true,
    },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: Date.now },
    sessionVersion: { type: Number, default: 0, required: true, select: false },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      required: true,
      select: false,
    },
    lockedUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

// Only documents whose role is ROOT participate in this unique index.
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: 'ROOT' } },
);

userSchema.set('toJSON', {
  transform(_document, value) {
    delete value.passwordHash;
    delete value.__v;
    return value;
  },
});

export function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}
export function toSafeUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  };
}

export default mongoose.models.User || mongoose.model('User', userSchema);
