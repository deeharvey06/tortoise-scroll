import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { requireAdmin, requireRoot } from '../middleware/auth.js';
import { changeUserRole, changeUserStatus, getUser, listAuditLog, listUsers } from '../controllers/adminController.js';

const router = Router();

router.get('/users', requireAdmin, asyncHandler(listUsers));
router.get('/users/:id', requireAdmin, asyncHandler(getUser));
router.patch('/users/:id/role', requireRoot, asyncHandler(changeUserRole));
router.patch('/users/:id/status', requireRoot, asyncHandler(changeUserStatus));
router.get('/audit-log', requireRoot, asyncHandler(listAuditLog));

export default router;
