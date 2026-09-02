import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  changePassword,
  getAccountSecurity,
  getActiveSessions,
  logoutOtherSessions,
  revokeSession,
} from '../controllers/accountSecurityController.js';

const router = Router();
router.get('/', asyncHandler(getAccountSecurity));
router.patch('/password', asyncHandler(changePassword));
router.get('/sessions', asyncHandler(getActiveSessions));
router.delete('/sessions/:id', asyncHandler(revokeSession));
router.post('/sessions/logout-others', asyncHandler(logoutOtherSessions));
export default router;
