import logger from '../config/logger.js';
import crypto from 'node:crypto';

export function requestLogger(req, res, next) {
  const start = Date.now();
  req.requestId = String(req.get('x-request-id') || crypto.randomUUID()).slice(
    0,
    128,
  );
  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        requestId: req.requestId,
      },
      'request completed',
    );
  });

  next();
}

export default requestLogger;
