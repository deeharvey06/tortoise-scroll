import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getAppSettings,
  saveAppSettings,
} from '../controllers/appSettingsController.js';

import {
  getPreferences,
  savePreferences,
} from '../controllers/workspaceController.js';
const router = Router();
router.get('/workspace', asyncHandler(getPreferences));
router.put('/workspace', asyncHandler(savePreferences));

router.get('/', asyncHandler(getAppSettings));
router.put('/', asyncHandler(saveAppSettings));

export default router;
