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

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = parse(
      registerSchema,
      req.body,
      res,
    );
    const emailNormalized = normalizeEmail(email);
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
    }).select('+passwordHash +sessionVersion');
    const passwordIsValid = await verifyPassword(
      user?.passwordHash || DUMMY_PASSWORD_HASH,
      password,
    );
    if (!user || !passwordIsValid) {
      res.status(401);
      throw new Error('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      res.status(403);
      throw new Error('Account is not active');
    }
    await regenerateSession(req);
    req.session.userId = String(user._id);
    req.session.sessionVersion = Number(user.sessionVersion || 0);
    await registerSession(req, user._id);
    user.lastLoginAt = new Date();
    await user.save();
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
