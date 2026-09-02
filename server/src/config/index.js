export function getConfig() {
  return {
    port: Number(process.env.PORT || 5050),
    mongoUri:
      process.env.MONGO_URI || 'mongodb://localhost:27017/trading-journal',
    clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    sessionSecret: process.env.SESSION_SECRET || '',
    sessionTtlMs: Number(process.env.SESSION_TTL || 43200000),
    allowedOrigins: String(
      process.env.ALLOWED_ORIGINS ||
        process.env.CLIENT_ORIGIN ||
        'http://localhost:5173',
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    nodeEnv: process.env.NODE_ENV || 'development',
    passwordResetTtlMs: Number(
      process.env.PASSWORD_RESET_TTL || 30 * 60 * 1000,
    ),
    exposeDevelopmentResetToken:
      process.env.NODE_ENV !== 'production' &&
      process.env.PASSWORD_RESET_DEV_EXPOSE_TOKEN === 'true',
  };
}

export default getConfig;
