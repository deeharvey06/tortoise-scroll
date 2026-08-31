import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { getSession, getMarketDataStatus } from '../controllers/replayController.js';

const router = Router();

router.get('/session', asyncHandler(getSession));
router.get('/market-data-status', asyncHandler(getMarketDataStatus));

export default router;
