import mongoose from 'mongoose';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import {
  roleChangeSchema,
  statusChangeSchema,
} from '../schemas/admin.schema.js';
import SessionRecord from '../models/SessionRecord.js';

const pageNumber = (value, fallback, max = Number.MAX_SAFE_INTEGER) =>
  Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);
const adminUser = (user) => ({
  id: String(user._id),
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  status: user.status,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
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
const idFilter = (id) => {
  if (!mongoose.isValidObjectId(id)) throw fail(400, 'Invalid user id');
  return { _id: id };
};
const visibleUserFilter = (req, extra = {}) => ({
  ...extra,
  ...(req.user.role === 'ADMIN' ? { role: { $ne: 'ROOT' } } : {}),
});

export async function listUsers(req, res) {
  const page = pageNumber(req.query.page, 1);
  const limit = pageNumber(req.query.limit, 25, 100);
  const search = String(req.query.search || '').trim();
  const filter = visibleUserFilter(req, {
    ...(search
      ? {
          $or: [
            {
              displayName: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                $options: 'i',
              },
            },
            {
              emailNormalized: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                $options: 'i',
              },
            },
          ],
        }
      : {}),
    ...(req.query.role && req.user.role === 'ROOT'
      ? { role: req.query.role }
      : {}),
    ...(req.query.status ? { status: req.query.status } : {}),
  });
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    users: users.map(adminUser),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function getUser(req, res) {
  const user = await User.findOne(
    visibleUserFilter(req, idFilter(req.params.id)),
  ).lean();
  if (!user) throw fail(404, 'User not found');
  res.json({ user: adminUser(user) });
}

async function recordChange(req, target, action, before, after) {
  await AuditLog.create({
    actorUserId: req.user.id,
    targetUserId: target._id,
    action,
    before,
    after,
    ipAddress: String(req.ip || '').slice(0, 128),
    userAgent: String(req.get?.('user-agent') || '').slice(0, 512),
  });
}

export async function changeUserRole(req, res) {
  const { role } = parse(roleChangeSchema, req.body);
  const current = await User.findOne({
    ...idFilter(req.params.id),
    role: { $ne: 'ROOT' },
  });
  if (!current) throw fail(404, 'User not found');
  if (current.role === role) return res.json({ user: adminUser(current) });
  const allowed =
    (current.role === 'USER' && role === 'ADMIN') ||
    (current.role === 'ADMIN' && role === 'USER');
  if (!allowed)
    throw fail(400, 'Only USER and ADMIN role transitions are permitted');
  const updated = await User.findOneAndUpdate(
    { _id: current._id, role: current.role },
    { $set: { role } },
    { new: true, runValidators: true },
  );
  if (!updated) throw fail(409, 'User changed concurrently; reload and retry');
  await recordChange(
    req,
    updated,
    'USER_ROLE_CHANGED',
    { role: current.role },
    { role: updated.role },
  );
  res.json({ user: adminUser(updated) });
}

export async function changeUserStatus(req, res) {
  const { status } = parse(statusChangeSchema, req.body);
  const current = await User.findOne({
    ...idFilter(req.params.id),
    role: { $ne: 'ROOT' },
  });
  if (!current) throw fail(404, 'User not found');
  if (current.status === status) return res.json({ user: adminUser(current) });
  const updated = await User.findOneAndUpdate(
    { _id: current._id, role: { $ne: 'ROOT' }, status: current.status },
    { $set: { status }, $inc: { sessionVersion: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw fail(409, 'User changed concurrently; reload and retry');
  await recordChange(
    req,
    updated,
    'USER_STATUS_CHANGED',
    { status: current.status },
    { status: updated.status },
  );
  if (status !== 'ACTIVE')
    await SessionRecord.deleteMany({ userId: updated._id });
  res.json({ user: adminUser(updated) });
}

export async function listAuditLog(req, res) {
  const page = pageNumber(req.query.page, 1);
  const limit = pageNumber(req.query.limit, 25, 100);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.targetUserId)
    Object.assign(filter, {
      targetUserId: idFilter(req.query.targetUserId)._id,
    });
  const [events, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actorUserId', 'displayName email role')
      .populate('targetUserId', 'displayName email role status')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({
    events,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export default {
  listUsers,
  getUser,
  changeUserRole,
  changeUserStatus,
  listAuditLog,
};
