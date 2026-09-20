import { randomUUID } from 'node:crypto';
import pino from 'pino';

// Logs are a deliberately small event protocol. Never serialize requests,
// headers, bodies, raw URLs, Errors, mail messages, or arbitrary log strings.
export function safeLogFields(input = {}) {
  const output = {};
  const patterns = {
    event: /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/,
    code: /^[A-Z][A-Z0-9_]{0,79}$/,
    requestId: /^[0-9a-f-]{36}$/,
    errorId: /^[0-9a-f-]{36}$/,
    actorUserId: /^[0-9a-f]{24}$/,
    method: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/,
    provider: /^(smtp|disabled|mongo|memory)$/,
    outcome: /^(success|failure|partial|timeout|rejected|started|stopped)$/,
    component:
      /^(http|database|storage|email|limiter|backup|queue|scheduler|startup|shutdown)$/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    if (typeof input[key] === 'string' && pattern.test(input[key]))
      output[key] = input[key];
  }

  for (const key of [
    'statusCode',
    'durationMs',
    'count',
    'failedCount',
    'port',
  ]) {
    if (Number.isFinite(input[key]) && input[key] >= 0)
      output[key] = input[key];
  }

  return output;
}

export function createLogger(destination) {
  const log = pino(
    {
      level: [
        'trace',
        'debug',
        'info',
        'warn',
        'error',
        'fatal',
        'silent',
      ].includes(process.env.LOG_LEVEL)
        ? process.env.LOG_LEVEL
        : 'info',
      formatters: { bindings: safeLogFields },
      base: undefined,
      hooks: {
        logMethod(args, method, level) {
          const fields = args[0] && typeof args[0] === 'object' ? args[0] : {};
          const safe = safeLogFields(fields);
          if (level >= 50 && !safe.errorId) safe.errorId = randomUUID();
          method.call(this, { event: 'APPLICATION_LOG', ...safe });
        },
      },
    },
    destination
  );

  return protectBindings(log);
}

function protectBindings(log) {
  // Pino resets child binding formatters by default; sanitize at the boundary.
  const child = log.child.bind(log),
    setBindings = log.setBindings.bind(log);

  log.child = (bindings) =>
    protectBindings(
      child(safeLogFields(bindings), {
        formatters: { bindings: safeLogFields },
      })
    );

  log.setBindings = (bindings) => setBindings(safeLogFields(bindings));
  return log;
}

export const logger = createLogger();
export default logger;
