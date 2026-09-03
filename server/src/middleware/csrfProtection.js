import logger from '../config/logger.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const securityError = (statusCode, publicMessage) =>
  Object.assign(new Error(publicMessage), {
    statusCode,
    publicMessage,
    isOperational: true,
  });

export function csrfProtection({ allowedOrigins, enforce = true }) {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (!enforce || SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    const marker = req.get('x-csrf-protection');
    if (origin && !allowed.has(origin)) {
      logger.warn(
        {
          event: 'CSRF_REJECTED',
          requestId: req.requestId,
          origin,
          method: req.method,
          url: req.originalUrl,
        },
        'request origin rejected',
      );
      return next(securityError(403, 'Request origin is not allowed'));
    }
    if (marker !== '1') {
      logger.warn(
        {
          event: 'CSRF_REJECTED',
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
        },
        'CSRF marker missing',
      );
      return next(securityError(403, 'CSRF protection header is required'));
    }
    return next();
  };
}

export default csrfProtection;
