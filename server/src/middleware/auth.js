import User, { toSafeUser } from '../models/User.js';
import {
  removeSessionRecord,
  touchSession,
} from '../services/sessionSecurityService.js';

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    const sessionId = req.sessionID;
    req.session.destroy(async (error) => {
      if (error) return reject(error);
      try {
        await removeSessionRecord(sessionId);
        resolve();
      } catch (cleanupError) {
        reject(cleanupError);
      }
    });
  });
}

export async function requireAuthentication(req, res, next) {
  try {
    if (!req.session?.userId) {
      res.status(401);
      throw new Error('Authentication required');
    }
    const user = await User.findById(req.session.userId).select(
      '+sessionVersion',
    );
    if (!user) {
      await destroySession(req);
      res.status(401);
      throw new Error('Authentication required');
    }
    if (user.status !== 'ACTIVE') {
      await destroySession(req);
      res.status(403);
      throw new Error('Account is not active');
    }
    const currentVersion = Number(user.sessionVersion || 0);
    if (req.session.sessionVersion == null && currentVersion === 0)
      req.session.sessionVersion = 0;
    if (Number(req.session.sessionVersion) !== currentVersion) {
      await destroySession(req);
      res.status(401);
      throw new Error('Session is no longer valid');
    }
    req.authUser = user;
    req.user = toSafeUser(user);
    await touchSession(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error('Insufficient permissions'));
    }
    return next();
  };
}

export const requireRoot = requireRole('ROOT');
export const requireAuth = requireAuthentication;
export const requireAdmin = requireRole('ROOT', 'ADMIN');
export default {
  requireAuthentication,
  requireAuth,
  requireRole,
  requireRoot,
  requireAdmin,
};
