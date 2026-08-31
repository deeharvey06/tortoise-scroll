import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { screenshotUpload } from '../middleware/upload.js';
import {
  uploadScreenshot,
  updateScreenshotCaption,
  deleteScreenshot,
} from '../controllers/screenshotController.js';

// Mounted at /api/trades/:id/screenshots
const router = Router({ mergeParams: true });

router.post('/', screenshotUpload.single('file'), asyncHandler(uploadScreenshot));
router.put('/:screenshotId', asyncHandler(updateScreenshotCaption));
router.delete('/:screenshotId', asyncHandler(deleteScreenshot));

export default router;
