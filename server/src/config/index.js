const integer = (
  name,
  fallback,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {},
) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return value;
};

export function getConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const allowedOrigins = String(
    process.env.ALLOWED_ORIGINS ||
      process.env.CLIENT_ORIGIN ||
      'http://localhost:5173',
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const sessionSecret = process.env.SESSION_SECRET || '';
  const config = {
    port: Number(process.env.PORT || 5050),
    mongoUri:
      process.env.MONGO_URI || 'mongodb://localhost:27017/trading-journal',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    sessionSecret,
    sessionTtlMs: integer('SESSION_TTL', 43_200_000, {
      min: 300_000,
      max: 2_592_000_000,
    }),
    allowedOrigins,
    nodeEnv,
    passwordResetTtlMs: integer('PASSWORD_RESET_TTL', 1_800_000, {
      min: 300_000,
      max: 86_400_000,
    }),
    authRateLimitWindowMs: integer('AUTH_RATE_LIMIT_WINDOW_MS', 900_000, {
      min: 60_000,
      max: 86_400_000,
    }),
    authRateLimitMax: integer('AUTH_RATE_LIMIT_MAX', 10, {
      min: 1,
      max: 1_000,
    }),
    passwordResetRateLimitMax: integer('PASSWORD_RESET_RATE_LIMIT_MAX', 5, {
      min: 1,
      max: 1_000,
    }),
    loginFailureLimit: integer('LOGIN_FAILURE_LIMIT', 5, { min: 2, max: 100 }),
    loginLockMs: integer('LOGIN_LOCK_MS', 900_000, {
      min: 60_000,
      max: 86_400_000,
    }),
    csrfProtectionEnabled: process.env.CSRF_PROTECTION_ENABLED
      ? process.env.CSRF_PROTECTION_ENABLED === 'true'
      : nodeEnv !== 'test',
    exposeDevelopmentResetToken:
      nodeEnv !== 'production' &&
      process.env.PASSWORD_RESET_DEV_EXPOSE_TOKEN === 'true',
  };
  if (nodeEnv !== 'test') {
    if (
      sessionSecret.length < 32 ||
      /replace-with|change-me|example/i.test(sessionSecret)
    )
      throw new Error(
        'SESSION_SECRET must be a non-placeholder value containing at least 32 characters',
      );
    if (!allowedOrigins.length)
      throw new Error(
        'ALLOWED_ORIGINS must contain at least one trusted frontend origin',
      );
    for (const origin of allowedOrigins) {
      let parsed;
      try {
        parsed = new URL(origin);
      } catch {
        throw new Error(
          `ALLOWED_ORIGINS contains an invalid origin: ${origin}`,
        );
      }
      if (
        parsed.origin !== origin ||
        !['http:', 'https:'].includes(parsed.protocol)
      )
        throw new Error(
          `ALLOWED_ORIGINS must contain exact HTTP(S) origins: ${origin}`,
        );
      if (nodeEnv === 'production' && parsed.protocol !== 'https:')
        throw new Error('Production ALLOWED_ORIGINS entries must use HTTPS');
    }
  }
  if (nodeEnv === 'production' && !config.csrfProtectionEnabled)
    throw new Error('CSRF protection cannot be disabled in production');
  return config;
}

export default getConfig;
