import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getStatus,
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  runConfig,
} from '../controllers/backtestController.js';

const router = Router();

router.get('/status', asyncHandler(getStatus));
router.get('/configs', asyncHandler(listConfigs));
router.post('/configs', asyncHandler(createConfig));
router.get('/configs/:id', asyncHandler(getConfig));
router.put('/configs/:id', asyncHandler(updateConfig));
router.delete('/configs/:id', asyncHandler(deleteConfig));
router.post('/configs/:id/run', asyncHandler(runConfig));

export default router;
