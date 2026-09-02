import SessionRecord from '../models/SessionRecord.js';

const storeDestroy = (store, sessionId) =>
  new Promise((resolve, reject) =>
    store.destroy(sessionId, (error) => (error ? reject(error) : resolve())),
  );
const metadata = (req) => ({
  ipAddress: String(req.ip || '').slice(0, 128),
  userAgent: String(req.get?.('user-agent') || '').slice(0, 512),
});

export async function registerSession(req, userId) {
  const now = new Date();
  const expiresAt = new Date(
    Date.now() + (req.session?.cookie?.maxAge || 12 * 60 * 60 * 1000),
  );
  await SessionRecord.findOneAndUpdate(
    { sessionId: req.sessionID },
    {
      $set: { userId, lastSeenAt: now, expiresAt, ...metadata(req) },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, runValidators: true },
  );
}

export async function touchSession(req) {
  if (!req.sessionID || !req.user?.id) return;
  const lastTouch = Number(req.session.securityRegistryTouchedAt || 0);
  if (Date.now() - lastTouch < 60_000) return;
  req.session.securityRegistryTouchedAt = Date.now();
  await registerSession(req, req.user.id);
}

export async function removeSessionRecord(sessionId) {
  if (sessionId) await SessionRecord.deleteOne({ sessionId });
}

export async function listSessions(userId, currentSessionId) {
  const records = await SessionRecord.find({
    userId,
    expiresAt: { $gt: new Date() },
  })
    .select('+sessionId')
    .sort({ lastSeenAt: -1 })
    .lean();
  return records.map((record) => ({
    id: String(record._id),
    current: record.sessionId === currentSessionId,
    createdAt: record.createdAt,
    lastSeenAt: record.lastSeenAt,
    expiresAt: record.expiresAt,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
  }));
}

export async function revokeSessionByRecordId(req, userId, recordId) {
  const record = await SessionRecord.findOne({ _id: recordId, userId }).select(
    '+sessionId',
  );
  if (!record) return false;
  if (record.sessionId === req.sessionID) {
    const error = new Error('Use sign out to revoke the current session');
    error.statusCode = 400;
    throw error;
  }
  await storeDestroy(req.sessionStore, record.sessionId);
  await SessionRecord.deleteOne({ _id: record._id, userId });
  return true;
}

export async function revokeOtherSessions(
  req,
  userId,
  currentSessionId = req.sessionID,
) {
  const records = await SessionRecord.find({
    userId,
    sessionId: { $ne: currentSessionId },
  })
    .select('+sessionId')
    .lean();
  await Promise.all(
    records.map((record) => storeDestroy(req.sessionStore, record.sessionId)),
  );
  const result = await SessionRecord.deleteMany({
    userId,
    sessionId: { $ne: currentSessionId },
  });
  return result.deletedCount;
}

export async function revokeAllSessions(req, userId) {
  const records = await SessionRecord.find({ userId })
    .select('+sessionId')
    .lean();
  await Promise.all(
    records.map((record) => storeDestroy(req.sessionStore, record.sessionId)),
  );
  await SessionRecord.deleteMany({ userId });
  return records.length;
}

export default {
  registerSession,
  touchSession,
  removeSessionRecord,
  listSessions,
  revokeSessionByRecordId,
  revokeOtherSessions,
  revokeAllSessions,
};
