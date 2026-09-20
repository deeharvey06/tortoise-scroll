/**
 * Central error handler. Never swallows an error silently — every failure
 * is logged server-side and returned to the client with a useful message.
 */
import crypto from 'node:crypto';
import logger from '../config/logger.js';

export function notFound(req, res, next) {
  res.status(404);
  next(new Error('Not found'));
}

export function errorHandler(err, req, res, _next) {
  const isClientInputError =
    err.name === 'ValidationError' || err.name === 'CastError';
  const statusCode =
    err.statusCode ||
    (isClientInputError
      ? 400
      : res.statusCode && res.statusCode !== 200
        ? res.statusCode
        : 500);

  const requestId = req.requestId || crypto.randomUUID();
  const errorId = crypto.randomUUID();

  if ([401, 403, 429].includes(statusCode))
    logger.warn({
      event: statusCode === 429 ? 'RATE_LIMIT_REJECTED' : 'ACCESS_REJECTED',
      requestId,
      outcome: 'rejected',
      statusCode,
    });

  logger.error({
    event: 'HTTP_REQUEST_FAILED',
    requestId,
    errorId,
    statusCode,
    method: req.method,
  });

  res.setHeader('X-Error-Id', errorId);

  const publicMessage =
    statusCode >= 500
      ? 'Internal server error'
      : err.publicMessage || err.message || 'Request failed';

  res.status(statusCode).json({
    error: {
      message: publicMessage,
      requestId,
      errorId,
      ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
    },
  });
}

export default { notFound, errorHandler };
