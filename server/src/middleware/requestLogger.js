import logger from '../config/logger.js';
import crypto from 'node:crypto';

export function requestLogger(req, res, next) {
  const start = Date.now();
  // Client identifiers can contain credentials; generate our own correlation ID.
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => {
    logger.info({
      event: 'HTTP_REQUEST_COMPLETED',
      method: req.method,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      requestId: req.requestId,
    });
  });
  next();
}
export default requestLogger;
