import { decodeSessionToken } from '../auth/users.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    res.status(401);
    throw new Error('Authentication required');
  }

  const user = decodeSessionToken(token);
  if (!user) {
    res.status(401);
    throw new Error('Invalid or expired session');
  }

  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Admin access required');
  }

  next();
}

export default { requireAuth, requireAdmin };
