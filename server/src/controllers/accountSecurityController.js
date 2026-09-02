import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User, { normalizeEmail, toSafeUser } from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import AuditLog from '../models/AuditLog.js';
import { getConfig } from '../config/index.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import {
  listSessions,
  registerSession,
  removeSessionRecord,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSessionByRecordId,
} from '../services/sessionSecurityService.js';

const fail = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });
const parse = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success)
    throw fail(
      400,
      result.error.issues.map((issue) => issue.message).join(', '),
    );
  return result.data;
};
const regenerate = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
const tokenHash = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
const auditMetadata = (req) => ({
  ipAddress: String(req.ip || '').slice(0, 128),
  userAgent: String(req.get?.('user-agent') || '').slice(0, 512),
});
const audit = (req, userId, action, before, after) =>
  AuditLog.create({
    actorUserId: userId,
    targetUserId: userId,
    action,
    before,
    after,
    ...auditMetadata(req),
  });

export async function getAccountSecurity(req, res) {
  res.json({
    user: req.user,
    sessionPolicy: {
      passwordChange: 'REVOKE_OTHERS_AND_ROTATE_CURRENT',
      passwordReset: 'REVOKE_ALL',
    },
  });
}

export async function getActiveSessions(req, res) {
  res.json({ sessions: await listSessions(req.user.id, req.sessionID) });
}

export async function revokeSession(req, res) {
  if (!mongoose.isValidObjectId(req.params.id))
    throw fail(400, 'Invalid session id');
  if (!(await revokeSessionByRecordId(req, req.user.id, req.params.id)))
    throw fail(404, 'Session not found');
  await audit(
    req,
    req.user.id,
    'SESSION_REVOKED',
    {},
    { sessionRecordId: req.params.id },
  );
  res.status(204).end();
}

export async function logoutOtherSessions(req, res) {
  const user = await User.findById(req.user.id).select('+sessionVersion');
  if (!user) throw fail(401, 'Authentication required');
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save();
  req.session.sessionVersion = user.sessionVersion;
  const revoked = await revokeOtherSessions(req, req.user.id);
  await audit(req, req.user.id, 'OTHER_SESSIONS_REVOKED', {}, { revoked });
  res.json({ revoked });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = parse(
    changePasswordSchema,
    req.body,
  );
  const user = await User.findById(req.user.id).select(
    '+passwordHash +sessionVersion',
  );
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword)))
    throw fail(400, 'Current password is incorrect');
  if (await verifyPassword(user.passwordHash, newPassword))
    throw fail(400, 'New password must be different from the current password');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save();
  const oldSessionId = req.sessionID;
  const revoked = await revokeOtherSessions(req, user._id, oldSessionId);
  await removeSessionRecord(oldSessionId);
  await regenerate(req);
  req.session.userId = String(user._id);
  req.session.sessionVersion = user.sessionVersion;
  await registerSession(req, user._id);
  await audit(
    req,
    user._id,
    'PASSWORD_CHANGED',
    {},
    { otherSessionsRevoked: revoked },
  );
  res.json({ user: toSafeUser(user), otherSessionsRevoked: revoked });
}

export async function forgotPassword(req, res) {
  const { email } = parse(forgotPasswordSchema, req.body);
  const user = await User.findOne({
    emailNormalized: normalizeEmail(email),
    status: 'ACTIVE',
  });
  let developmentResetToken;
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const config = getConfig();
    await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null });
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + config.passwordResetTtlMs),
    });
    if (config.exposeDevelopmentResetToken) developmentResetToken = token;
  }
  res.json({
    message:
      'If an active account matches that email, a password reset request has been created.',
    deliveryConfigured: false,
    ...(developmentResetToken ? { developmentResetToken } : {}),
  });
}

export async function resetPassword(req, res) {
  const { token, newPassword } = parse(resetPasswordSchema, req.body);
  const reset = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash: tokenHash(token),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!reset) throw fail(400, 'Reset link is invalid or has expired');
  const user = await User.findOne({
    _id: reset.userId,
    status: 'ACTIVE',
  }).select('+passwordHash +sessionVersion');
  if (!user) throw fail(400, 'Reset link is invalid or has expired');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save();
  const revoked = await revokeAllSessions(req, user._id);
  if (req.session?.userId) {
    await new Promise((resolve, reject) =>
      req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
  }
  await audit(
    req,
    user._id,
    'PASSWORD_RESET',
    {},
    { sessionsRevoked: revoked },
  );
  res.json({ message: 'Password reset. Sign in with your new password.' });
}

export default {
  getAccountSecurity,
  getActiveSessions,
  revokeSession,
  logoutOtherSessions,
  changePassword,
  forgotPassword,
  resetPassword,
};
