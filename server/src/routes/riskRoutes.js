import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { getSettings, upsertSettings, getDashboard } from '../controllers/riskController.js';

const router = Router();

router.get('/settings', asyncHandler(getSettings));
router.put('/settings', asyncHandler(upsertSettings));
router.get('/dashboard', asyncHandler(getDashboard));

export default router;
