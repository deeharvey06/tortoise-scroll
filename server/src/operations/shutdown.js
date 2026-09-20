import logger from '../config/logger.js';
export function createShutdown({
  state,
  server,
  stopScheduling,
  drainJobs,
  closeResources,
  timeoutMs = 30000,
  forceExit = () => process.exit(1),
}) {
  let shutdown;
  return () => {
    if (shutdown) return shutdown;
    state.draining = true;
    logger.info({
      event: 'SHUTDOWN_STARTED',
      component: 'shutdown',
      outcome: 'started',
    });
    shutdown = (async () => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        logger.error({
          event: 'SHUTDOWN_TIMEOUT',
          component: 'shutdown',
          outcome: 'timeout',
        });
        server.closeAllConnections?.();
        forceExit();
      }, timeoutMs);
      try {
        const stopped = Promise.resolve().then(stopScheduling);
        const httpClosed = new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeIdleConnections?.();
        });
        await Promise.all([
          stopped,
          httpClosed,
          Promise.resolve().then(drainJobs),
        ]);
        await closeResources();
        if (!timedOut)
          logger.info({
            event: 'SHUTDOWN_COMPLETED',
            component: 'shutdown',
            outcome: 'success',
          });
      } catch {
        logger.error({
          event: 'SHUTDOWN_FAILED',
          component: 'shutdown',
          outcome: 'failure',
        });
        server.closeAllConnections?.();
        forceExit();
      } finally {
        clearTimeout(timer);
      }
    })();
    return shutdown;
  };
}
