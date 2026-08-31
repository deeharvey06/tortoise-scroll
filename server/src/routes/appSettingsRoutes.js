import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { getAppSettings, saveAppSettings } from '../controllers/appSettingsController.js';

const router = Router();

router.get('/', asyncHandler(getAppSettings));
router.put('/', asyncHandler(saveAppSettings));

export default router;
