import test from 'node:test';
import assert from 'node:assert/strict';
import { jobQueue } from '../src/queue/jobQueue.js';

test('jobQueue registers handlers and executes jobs', async () => {
  const handler = async (payload, reportProgress) => {
    reportProgress(50);
    return { success: true, data: payload.input };
  };

  jobQueue.register('test-job', handler);
  const jobId = await jobQueue.enqueue('test-job', { input: 'hello' });

  assert.ok(jobId, 'Job ID should be returned');

  const status = jobQueue.getJobStatus(jobId);
  assert.ok(status, 'Job status should exist');
  assert.equal(status.type, 'test-job', 'Job type should match');

  // Wait for job to complete
  const result = await jobQueue.waitForJob(jobId);
  assert.deepEqual(result, { success: true, data: 'hello' });

  const finalStatus = jobQueue.getJobStatus(jobId);
  assert.equal(finalStatus.status, 'completed', 'Job should be completed');
  assert.equal(finalStatus.result.success, true);
});

test('jobQueue handles job failures gracefully', async () => {
  const handler = async () => {
    throw new Error('Test error');
  };

  jobQueue.register('fail-job', handler);
  const jobId = await jobQueue.enqueue('fail-job', {});

  try {
    await jobQueue.waitForJob(jobId);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.match(err.message, /Test error/);
  }

  const status = jobQueue.getJobStatus(jobId);
  assert.equal(status.status, 'failed');
  assert.match(status.error, /Test error/);
});

test('jobQueue reports progress correctly', async () => {
  let progressValues = [];

  const handler = async (payload, reportProgress) => {
    reportProgress(25);
    reportProgress(50);
    reportProgress(75);
    return 'done';
  };

  jobQueue.on('job:progress', ({ progress }) => {
    progressValues.push(progress);
  });

  jobQueue.register('progress-job', handler);
  const jobId = await jobQueue.enqueue('progress-job', {});

  await jobQueue.waitForJob(jobId);

  // The final 100 is set when the job completes
  assert.deepEqual(progressValues, [25, 50, 75]);
});

test('jobQueue tracks queue statistics', async () => {
  const handler = async (payload, reportProgress) => {
    return 'result';
  };

  jobQueue.register('stat-job', handler);

  const stats = jobQueue.getQueueStats();
  const initialCompleted = stats.completed;

  const jobId = await jobQueue.enqueue('stat-job', {});
  await jobQueue.waitForJob(jobId);

  const newStats = jobQueue.getQueueStats();
  assert.equal(newStats.completed, initialCompleted + 1);
});
