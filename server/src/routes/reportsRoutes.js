import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { getReport } from '../controllers/reportsController.js';

const router = Router();

router.get('/:category', asyncHandler(getReport));

export default router;
