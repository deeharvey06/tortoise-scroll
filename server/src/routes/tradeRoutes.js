import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import {
  getTrades,
  getTrade,
  postTrade,
  putTrade,
  deleteTradeHandler,
  bulkDeleteHandler,
  bulkTagHandler,
  exportTradesCsv,
} from '../controllers/tradeController.js';
import screenshotRoutes from './screenshotRoutes.js';

const router = Router();

router.get('/', asyncHandler(getTrades));
router.get('/export', asyncHandler(exportTradesCsv));
router.post('/', asyncHandler(postTrade));
router.post('/bulk-delete', asyncHandler(bulkDeleteHandler));
router.post('/bulk-tag', asyncHandler(bulkTagHandler));
router.get('/:id', asyncHandler(getTrade));
router.put('/:id', asyncHandler(putTrade));
router.delete('/:id', asyncHandler(deleteTradeHandler));
router.use('/:id/screenshots', screenshotRoutes);

export default router;
