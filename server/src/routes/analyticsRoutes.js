import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { getDashboard, getCalendar } from '../controllers/analyticsController.js';

const router = Router();

router.get('/dashboard', asyncHandler(getDashboard));
router.get('/calendar', asyncHandler(getCalendar));

export default router;
