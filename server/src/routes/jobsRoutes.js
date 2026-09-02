/**
 * Routes for job queue status and management
 *
 * GET  /api/jobs/:jobId          - Get job status and progress
 * GET  /api/jobs/:jobId/wait     - Wait for job completion and return result
 * GET  /api/jobs/stats            - Get queue statistics
 */

import express from 'express';
import { jobQueue } from '../queue/jobQueue.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Get job status
 * Returns: { id, type, status, progress, result, error, createdAt, startedAt, completedAt }
 */
router.get('/:jobId', requireAuth, (req, res) => {
  const { jobId } = req.params;
  const status = jobQueue.getJobStatus(jobId, req.user.id);

  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(status);
});

/**
 * Wait for job completion
 * Blocks until the job completes, times out, or fails
 * Timeout defaults to 5 minutes
 */
router.get('/:jobId/wait', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const timeout = parseInt(req.query.timeout || '300000', 10);

  try {
    const result = await jobQueue.waitForJob(jobId, timeout, req.user.id);
    res.json({ result });
  } catch (err) {
    const status = jobQueue.getJobStatus(jobId, req.user.id);
    if (!status) {
      res.status(404).json({ error: 'Job not found' });
    } else if (status.status === 'failed') {
      res.status(400).json({ error: status.error });
    } else if (err.message.includes('timeout')) {
      res.status(408).json({ error: 'Job processing timeout' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * Get queue statistics
 */
router.get('/', requireAuth, (req, res) => {
  const stats = jobQueue.getQueueStats(req.user.id);
  res.json(stats);
});

export default router;
