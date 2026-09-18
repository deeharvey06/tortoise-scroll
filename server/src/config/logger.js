import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    // Test workers must not wait on a pretty-print worker during shutdown.
    ['production', 'test'].includes(process.env.NODE_ENV)
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
});

export default logger;
