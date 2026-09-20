import mongoose from 'mongoose';
import {
  startBrokerSyncScheduler,
  stopBrokerSyncScheduler,
} from '../services/brokerSyncScheduler.js';
import { createApp } from '../app.js';
import { connectDB } from '../config/db.js';
import { provisionRootUser } from '../auth/rootProvisioning.js';
import { getConfig } from '../config/index.js';
import logger from '../config/logger.js';
import { initializeRateLimits } from '../operations/rateLimitStore.js';
import { storageHealth } from '../operations/health.js';
import { createShutdown } from '../operations/shutdown.js';
import { jobQueue } from '../queue/jobQueue.js';
import { createEmailProvider } from '../services/email/index.js';
import { uploadsRootPath } from '../middleware/upload.js';

export async function startServer() {
  let config, app, email;

  try {
    config = getConfig();
    await connectDB();
    await initializeRateLimits(config);

    if (!(await storageHealth(uploadsRootPath)))
      throw Object.assign(new Error('Storage unavailable'), {
        code: 'STORAGE_UNAVAILABLE',
      });

    email = createEmailProvider(config);
    if (email.enabled) await email.verify();

    await provisionRootUser();
    const state = { draining: false };
    app = createApp({ emailProvider: email, operationsState: state });
    // Session TTL initialization must complete before readiness or shutdown.
    await app.locals.sessionStore.collectionP;
    const server = app.listen(config.port);

    server.on('error', () => {
      logger.fatal({
        event: 'HTTP_LISTEN_FAILED',
        component: 'startup',
        outcome: 'failure',
      });
      process.exit(1);
    });

    const shutdown = createShutdown({
      state,
      server,
      stopScheduling: stopBrokerSyncScheduler,
      drainJobs: () => jobQueue.drain(),
      closeResources: async () => {
        await app.locals.emailDelivery.drain();
        await email.close();
        await app.locals.sessionStore.close?.();
        await mongoose.disconnect();
      },
      timeoutMs: config.shutdownTimeoutMs,
    });

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('unhandledRejection', () => {
      logger.fatal({
        event: 'UNHANDLED_REJECTION',
        component: 'shutdown',
        outcome: 'failure',
      });
      process.exitCode = 1;
      shutdown();
    });

    process.on('uncaughtException', () => {
      logger.fatal({
        event: 'UNCAUGHT_EXCEPTION',
        component: 'shutdown',
        outcome: 'failure',
      });

      process.exitCode = 1;
      shutdown();
    });

    server.on('listening', () => {
      startBrokerSyncScheduler();
      logger.info({
        event: 'SERVER_STARTED',
        component: 'startup',
        port: config.port,
        outcome: 'success',
      });
    });
  } catch (error) {
    logger.fatal({
      event: 'STARTUP_FAILED',
      component: 'startup',
      code: error.code,
      outcome: 'failure',
    });

    await email?.close().catch(() => {});
    await app?.locals.sessionStore.close?.().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  }
}
