import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('./.env', import.meta.url)),
  quiet: true,
});

try {
  const { getConfig } = await import('./src/config/index.js');
  getConfig(); // Validate before modules create storage directories or clients.

  const { startServer } = await import('./src/operations/startServer.js');
  await startServer();
} catch (error) {
  const { default: logger } = await import('./src/config/logger.js');

  logger.fatal({
    event: 'STARTUP_FAILED',
    component: 'startup',
    code: error.code,
    outcome: 'failure',
  });

  process.exitCode = 1;
}
