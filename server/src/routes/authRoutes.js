import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { createSessionToken, verifyCredentials } from '../auth/users.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema } from '../schemas/auth.schema.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400);
      throw new Error(
        parsed.error.issues.map((issue) => issue.message).join(', '),
      );
    }

    const { username, password } = parsed.data;
    const user = verifyCredentials(username, password);
    if (!user) {
      res.status(401);
      throw new Error('Invalid username or password');
    }

    const token = createSessionToken(user.username);
    res.json({ token, user });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

export default router;
