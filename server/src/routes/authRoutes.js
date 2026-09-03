import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import User, { normalizeEmail, toSafeUser } from '../models/User.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../auth/passwords.js';
import { destroySession, requireAuthentication } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import {
  forgotPassword,
  resetPassword,
} from '../controllers/accountSecurityController.js';
import { registerSession } from '../services/sessionSecurityService.js';
import AuditLog from '../models/AuditLog.js';
import { getConfig } from '../config/index.js';

const router = Router();

function parse(schema, body, res) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(', '),
    );
  }
  return parsed.data;
}

function regenerateSession(req) {
  return new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
}

const loginAudit = (req, user, action, reason) =>
  AuditLog.create({
    actorUserId: user._id,
    targetUserId: user._id,
    action,
    before: {},
    after: { reason },
    ipAddress: String(req.ip || '').slice(0, 128),
    userAgent: String(req.get?.('user-agent') || '').slice(0, 512),
  });

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = parse(
      registerSchema,
      req.body,
      res,
    );
    const emailNormalized = normalizeEmail(email);
    if (emailNormalized === normalizeEmail(process.env.ROOT_USER_EMAIL)) {
      res.status(400);
      throw new Error('This email address is reserved');
    }
    if (await User.exists({ emailNormalized })) {
      res.status(409);
      throw new Error('An account with that email already exists');
    }
    const user = await User.create({
      email: email.trim(),
      emailNormalized,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'USER',
    });
    res.status(201).json({ user: toSafeUser(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(loginSchema, req.body, res);
    const user = await User.findOne({
      emailNormalized: normalizeEmail(email),
    }).select(
      '+passwordHash +sessionVersion +failedLoginAttempts +lockedUntil',
    );
    const config = getConfig();
    const isLocked = Boolean(
      user?.lockedUntil && user.lockedUntil > new Date(),
    );
    const passwordIsValid = await verifyPassword(
      user?.passwordHash || DUMMY_PASSWORD_HASH,
      password,
    );
    if (!user || !passwordIsValid || isLocked) {
      if (user) {
        if (!isLocked) {
          user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
          const lockedNow =
            user.failedLoginAttempts >= config.loginFailureLimit;
          if (lockedNow)
            user.lockedUntil = new Date(Date.now() + config.loginLockMs);
          await user.save();
          await loginAudit(
            req,
            user,
            lockedNow ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
            lockedNow ? 'FAILURE_LIMIT_REACHED' : 'INVALID_CREDENTIALS',
          );
        } else {
          await loginAudit(
            req,
            user,
            'LOGIN_FAILED',
            'ACCOUNT_TEMPORARILY_LOCKED',
          );
        }
      }
      res.status(401);
      throw new Error('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      await loginAudit(req, user, 'LOGIN_FAILED', 'ACCOUNT_NOT_ACTIVE');
      res.status(403);
      throw new Error('Account is not active');
    }
    await regenerateSession(req);
    req.session.userId = String(user._id);
    req.session.sessionVersion = Number(user.sessionVersion || 0);
    await registerSession(req, user._id);
    user.lastLoginAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    await loginAudit(req, user, 'LOGIN_SUCCEEDED', 'PASSWORD_AUTHENTICATION');
    res.json({ user: toSafeUser(user) });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req);
    const { maxAge: _maxAge, ...clearOptions } =
      req.app.locals.sessionCookieOptions;
    res.clearCookie(req.app.locals.sessionCookieName, clearOptions);
    res.status(204).end();
  }),
);

router.get('/me', requireAuthentication, (req, res) =>
  res.json({ user: req.user }),
);
router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));

export default router;
