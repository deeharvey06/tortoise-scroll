import path from 'node:path';
import { isIP } from 'node:net';

const invalid = (key) => {
  throw Object.assign(new Error(`Invalid or missing ${key}`), { code: key });
};

const placeholder = (value) =>
  /replace.with|change.me|example|placeholder|test.only/i.test(value || '');

export function operationsConfig(base, env = process.env) {
  const production = base.nodeEnv === 'production';

  if (
    env.LOG_LEVEL &&
    !['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(
      env.LOG_LEVEL
    )
  )
    invalid('LOG_LEVEL');

  const provider = env.EMAIL_PROVIDER || 'disabled';

  if (!['smtp', 'disabled'].includes(provider)) invalid('EMAIL_PROVIDER');

  const email = {
    provider,
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    password: env.SMTP_PASSWORD || '',
    from: env.EMAIL_FROM || '',
  };

  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE))
    invalid('SMTP_SECURE');

  if (provider === 'smtp') {
    for (const [key, value] of Object.entries({
      SMTP_HOST: email.host,
      SMTP_USER: email.user,
      SMTP_PASSWORD: email.password,
      EMAIL_FROM: email.from,
    }))
      if (!value || /[\r\n]/.test(value)) invalid(key);

    if (!Number.isInteger(email.port) || email.port < 1 || email.port > 65535)
      invalid('SMTP_PORT');

    if (!/^[^\s<>@]+@[^\s<>@]+$/.test(email.from)) invalid('EMAIL_FROM');
  }

  const resetUrl =
    env.PASSWORD_RESET_URL || `${base.clientOrigin}/reset-password`;

  let reset;
  try {
    reset = new URL(resetUrl);
  } catch {
    invalid('PASSWORD_RESET_URL');
  }

  if (
    !['http:', 'https:'].includes(reset.protocol) ||
    reset.username ||
    reset.password ||
    reset.search ||
    reset.hash
  )
    invalid('PASSWORD_RESET_URL');

  const rateLimitStore =
    env.RATE_LIMIT_STORE || (production ? 'mongo' : 'memory');

  if (!['mongo', 'memory'].includes(rateLimitStore))
    invalid('RATE_LIMIT_STORE');

  const proxy = env.TRUST_PROXY || 'none';
  const trustProxy =
    proxy === 'none' ? false : proxy.split(',').map((s) => s.trim());

  if (trustProxy)
    for (const entry of trustProxy) {
      if (['loopback', 'linklocal', 'uniquelocal'].includes(entry)) continue;
      const [address, mask, extra] = entry.split('/');
      const family = isIP(address);
      if (
        !family ||
        extra ||
        (mask !== undefined &&
          (!/^\d+$/.test(mask) ||
            +mask < 1 ||
            +mask > (family === 4 ? 32 : 128)))
      )
        invalid('TRUST_PROXY');
    }

  const shutdownTimeoutMs = Number(env.SHUTDOWN_TIMEOUT_MS || 30000);

  if (
    !Number.isInteger(shutdownTimeoutMs) ||
    shutdownTimeoutMs < 100 ||
    shutdownTimeoutMs > 120000
  )
    invalid('SHUTDOWN_TIMEOUT_MS');
  const deploymentMode = env.DEPLOYMENT_MODE || 'single';
  const storageMode = env.UPLOADS_STORAGE_MODE || 'local';

  if (!['single', 'multi'].includes(deploymentMode)) invalid('DEPLOYMENT_MODE');
  if (!['local', 'shared'].includes(storageMode))
    invalid('UPLOADS_STORAGE_MODE');

  if (production) {
    if (
      !env.MONGO_URI ||
      !/^mongodb(\+srv)?:\/\//.test(env.MONGO_URI) ||
      placeholder(env.MONGO_URI)
    )
      invalid('MONGO_URI');

    if (
      !/^mongodb\+srv:/.test(env.MONGO_URI) &&
      !/[?&](tls|ssl)=true(?:&|$)/.test(env.MONGO_URI)
    )
      invalid('MONGO_TLS');

    if (
      !env.MONGO_URI.includes('@') &&
      !/[?&]authMechanism=MONGODB-(X509|AWS)(?:&|$)/.test(env.MONGO_URI)
    )
      invalid('MONGO_AUTHENTICATION');

    if (
      /[?&](tlsInsecure|tlsAllowInvalidCertificates|tlsAllowInvalidHostnames)=true(?:&|$)/.test(
        env.MONGO_URI
      ) ||
      /[?&](tls|ssl|sslValidate)=false(?:&|$)/.test(env.MONGO_URI)
    )
      invalid('MONGO_TLS');

    if (!env.ALLOWED_ORIGINS) invalid('ALLOWED_ORIGINS');
    if (
      !env.CLIENT_ORIGIN ||
      !env.CLIENT_ORIGIN.startsWith('https://') ||
      !base.allowedOrigins.includes(env.CLIENT_ORIGIN)
    )
      invalid('CLIENT_ORIGIN');

    if (
      !env.PASSWORD_RESET_URL ||
      reset.protocol !== 'https:' ||
      !base.allowedOrigins.includes(reset.origin)
    )
      invalid('PASSWORD_RESET_URL');

    if (provider !== 'smtp') invalid('EMAIL_PROVIDER');
    if (placeholder(email.password)) invalid('SMTP_PASSWORD');
    if (rateLimitStore !== 'mongo') invalid('RATE_LIMIT_STORE');
    if (!env.TRUST_PROXY) invalid('TRUST_PROXY');
    if (!env.UPLOADS_DIR || !path.isAbsolute(env.UPLOADS_DIR))
      invalid('UPLOADS_DIR');

    if (!env.UPLOADS_STORAGE_MODE) invalid('UPLOADS_STORAGE_MODE');
    if (env.PASSWORD_RESET_DEV_EXPOSE_TOKEN === 'true')
      invalid('PASSWORD_RESET_DEV_EXPOSE_TOKEN');

    if (env.DEBUG || env.NODE_DEBUG || env.NODE_DEBUG_NATIVE)
      invalid('DEBUG_LOGGING');

    if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
      invalid('NODE_TLS_REJECT_UNAUTHORIZED');

    if (deploymentMode === 'multi' && storageMode !== 'shared')
      invalid('UPLOADS_STORAGE_MODE');

    if (
      deploymentMode === 'multi' &&
      env.BROKER_SYNC_SCHEDULER_ENABLED !== 'false'
    )
      invalid('BROKER_SYNC_SCHEDULER_ENABLED');
  }

  return {
    email,
    resetUrl,
    rateLimitStore,
    trustProxy,
    shutdownTimeoutMs,
    deploymentMode,
    storageMode,
  };
}
