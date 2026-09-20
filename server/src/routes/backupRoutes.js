import logger from '../config/logger.js';
import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import { exportAll, importAll } from '../controllers/backupController.js';

const router = Router();
router.use((req, res, next) => {
  const started = Date.now();
  const operation = req.method === 'GET' ? 'BACKUP_EXPORT' : 'BACKUP_RESTORE';
  logger.info({
    event: `${operation}_STARTED`,
    component: 'backup',
    requestId: req.requestId,
    outcome: 'started',
  });
  res.on('finish', () => {
    const failed = res.statusCode >= 400 || res.locals?.backupFailed;
    logger[failed ? 'error' : 'info']({
      event: `${operation}_${failed ? 'FAILED' : 'COMPLETED'}`,
      component: 'backup',
      requestId: req.requestId,
      outcome: failed ? 'failure' : 'success',
      durationMs: Date.now() - started,
    });
  });
  next();
});

router.get('/export', asyncHandler(exportAll));
router.post('/import', asyncHandler(importAll));

export default router;
