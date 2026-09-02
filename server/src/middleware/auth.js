import User, { toSafeUser } from '../models/User.js';

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

export async function requireAuthentication(req, res, next) {
  try {
    if (!req.session?.userId) { res.status(401); throw new Error('Authentication required'); }
    const user = await User.findById(req.session.userId);
    if (!user) { await destroySession(req); res.status(401); throw new Error('Authentication required'); }
    if (user.status !== 'ACTIVE') { await destroySession(req); res.status(403); throw new Error('Account is not active'); }
    req.authUser = user;
    req.user = toSafeUser(user);
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) { res.status(403); return next(new Error('Insufficient permissions')); }
    return next();
  };
}

export const requireRoot = requireRole('ROOT');
export const requireAuth = requireAuthentication;
export const requireAdmin = requireRole('ROOT', 'ADMIN');
export default { requireAuthentication, requireAuth, requireRole, requireRoot, requireAdmin };
