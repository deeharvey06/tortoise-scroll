/**
 * Job Queue abstraction layer
 *
 * Supports in-memory queue for development and file-based persistence.
 * Can be upgraded to Bull + Redis for production.
 *
 * Usage:
 *   jobQueue.register('import-trades', importHandler)
 *   const jobId = await jobQueue.enqueue('import-trades', { buffer, mapping })
 *   const status = await jobQueue.getJobStatus(jobId)
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.handlers = new Map();
    this.jobs = new Map();
    this.queue = [];
    this.processing = false;
    this.concurrency = 3;
    this.activeJobs = new Set();
  }

  register(jobType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for ${jobType} must be a function`);
    }
    this.handlers.set(jobType, handler);
  }

  async enqueue(jobType, payload = {}, userId = null) {
    if (!this.handlers.has(jobType)) {
      throw new Error(`No handler registered for job type: ${jobType}`);
    }

    const jobId = randomUUID();
    const job = {
      id: jobId,
      type: jobType,
      payload,
      status: 'pending',
      result: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      progress: 0,
      userId: userId ? String(userId) : null,
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);

    this.emit('job:enqueued', { jobId, jobType });
    this.process().catch((err) => {
      console.error('Queue processing error:', err);
    });

    return jobId;
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0 && this.activeJobs.size < this.concurrency) {
        const jobId = this.queue.shift();
        const job = this.jobs.get(jobId);

        if (!job || job.status !== 'pending') continue;

        this.activeJobs.add(jobId);
        this.executeJob(job).finally(() => {
          this.activeJobs.delete(jobId);
        });
      }
    } finally {
      this.processing = false;
    }
  }

  async executeJob(job) {
    try {
      job.status = 'running';
      job.startedAt = new Date();
      this.emit('job:started', { jobId: job.id, jobType: job.type });

      const handler = this.handlers.get(job.type);
      const result = await handler(job.payload, (progress) => {
        job.progress = progress;
        this.emit('job:progress', { jobId: job.id, progress });
      });

      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      this.emit('job:completed', { jobId: job.id, result });
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      this.emit('job:failed', { jobId: job.id, error: error.message });
    }

    this.process().catch((err) => {
      console.error('Queue processing error:', err);
    });
  }

  getJobStatus(jobId, userId = undefined) {
    const job = this.jobs.get(jobId);
    if (!job || (userId !== undefined && job.userId !== String(userId))) return null;

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  async waitForJob(jobId, timeoutMs = 300000, userId = undefined) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const job = this.jobs.get(jobId);
        if (!job || (userId !== undefined && job.userId !== String(userId))) {
          reject(new Error(`Job not found: ${jobId}`));
          return;
        }

        if (job.status === 'completed') {
          resolve(job.result);
        } else if (job.status === 'failed') {
          reject(new Error(job.error));
        } else if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Job timeout: ${jobId}`));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      checkStatus();
    });
  }

  getQueueStats(userId = undefined) {
    const jobs = userId === undefined ? Array.from(this.jobs.values()) : Array.from(this.jobs.values()).filter((job) => job.userId === String(userId));
    return {
      pending: jobs.filter(
        (j) => j.status === 'pending',
      ).length,
      running: jobs.filter(
        (j) => j.status === 'running',
      ).length,
      completed: jobs.filter(
        (j) => j.status === 'completed',
      ).length,
      failed: jobs.filter(
        (j) => j.status === 'failed',
      ).length,
      total: jobs.length,
    };
  }

  clearCompleted() {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.delete(jobId);
      }
    }
  }
}

export const jobQueue = new JobQueue();
export default jobQueue;
