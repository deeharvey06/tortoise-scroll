/**
 * Central error handler. Never swallows an error silently — every failure
 * is logged server-side and returned to the client with a useful message.
 */
export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  const isClientInputError =
    err.name === 'ValidationError' || err.name === 'CastError';
  const statusCode = err.statusCode || (isClientInputError
    ? 400
    : res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500);

  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
    },
  });
}

export default { notFound, errorHandler };
