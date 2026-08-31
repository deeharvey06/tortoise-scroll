import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { exportAll, importAll } from '../controllers/backupController.js';

const router = Router();

router.get('/export', asyncHandler(exportAll));
router.post('/import', asyncHandler(importAll));

export default router;
