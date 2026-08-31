import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { mediaUpload } from '../middleware/upload.js';
import Strategy from '../models/Strategy.js';
import createImageHandlers from '../utils/imageHandlers.js';
import {
  listStrategies,
  getStrategy,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  getStrategyPerformance,
} from '../controllers/strategyController.js';

const router = Router();
const images = createImageHandlers(Strategy);

router.get('/', asyncHandler(listStrategies));
router.post('/', asyncHandler(createStrategy));
router.get('/:id', asyncHandler(getStrategy));
router.put('/:id', asyncHandler(updateStrategy));
router.delete('/:id', asyncHandler(deleteStrategy));
router.get('/:id/performance', asyncHandler(getStrategyPerformance));
router.post('/:id/images', mediaUpload.single('file'), asyncHandler(images.upload));
router.put('/:id/images/:imageId', asyncHandler(images.updateCaption));
router.delete('/:id/images/:imageId', asyncHandler(images.remove));

export default router;
