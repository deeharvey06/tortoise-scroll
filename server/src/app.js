import { searchWorkspace } from './controllers/workspaceController.js';
import workflowAsyncHandler from './middleware/asyncHandler.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from './config/logger.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import tradeRoutes from './routes/tradeRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import importRoutes from './routes/importRoutes.js';
import journalRoutes from './routes/journalRoutes.js';
import tagRoutes from './routes/tagRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import strategyRoutes from './routes/strategyRoutes.js';
import playbookRoutes from './routes/playbookRoutes.js';
import riskRoutes from './routes/riskRoutes.js';
import replayRoutes from './routes/replayRoutes.js';
import { createReplayRunRouter } from './routes/replayRunRoutes.js';
import backtestRoutes from './routes/backtestRoutes.js';
import { createMarketDataRouter } from './routes/marketDataRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import agentsRoutes from './routes/agentsRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import appSettingsRoutes from './routes/appSettingsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import jobsRoutes from './routes/jobsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import accountSecurityRoutes from './routes/accountSecurityRoutes.js';
import brokerConnectionRoutes from './routes/brokerConnectionRoutes.js';
import instrumentSpecificationRoutes from './routes/instrumentSpecificationRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';

import { registerBrokerProvider } from './services/brokers/providerRegistry.js';
import { thinkorswimProvider } from './services/brokers/thinkorswimProvider.js';

import { jobQueue } from './queue/jobQueue.js';
import * as jobHandlers from './queue/handlers.js';

import { notFound, errorHandler } from './middleware/errorHandler.js';
import { uploadsRootPath } from './middleware/upload.js';
import { requireAuth } from './middleware/auth.js';
import requestLogger from './middleware/requestLogger.js';
import csrfProtection from './middleware/csrfProtection.js';
import inputSafety from './middleware/inputSafety.js';

import { getConfig } from './config/index.js';
import Trade from './models/Trade.js';
import Strategy from './models/Strategy.js';
import Playbook from './models/Playbook.js';

import { EmailDelivery } from './services/email/delivery.js';
import { createEmailProvider } from './services/email/index.js';
import { createRateLimitStore } from './operations/rateLimitStore.js';
import { createReadiness } from './operations/health.js';

// Register job handlers
jobQueue.register('import-trades', jobHandlers.handleTradeImport);
jobQueue.register(
  'performance-analysis',
  jobHandlers.handlePerformanceAnalysis
);

jobQueue.register('risk-assessment', jobHandlers.handleRiskAssessment);
jobQueue.register('auto-tagger', jobHandlers.handleAutoTagger);

registerBrokerProvider(thinkorswimProvider);

export function createApp(options = {}) {
  const app = express();
  const config = getConfig();

  app.disable('x-powered-by');
  app.set('query parser', 'simple');

  const sessionCookieName =
    config.nodeEnv === 'production' ? '__Host-tortoise.sid' : 'tortoise.sid';

  const sessionCookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: config.sessionTtlMs,
    path: '/',
  };

  app.set('trust proxy', config.trustProxy);
  app.locals.operationsState = options.operationsState || { draining: false };
  app.locals.emailProvider =
    options.emailProvider || createEmailProvider(config);

  app.locals.emailDelivery = new EmailDelivery(app.locals.emailProvider);

  const rateStore = (name) =>
    options.rateLimitStoreFactory?.(name) || createRateLimitStore(config, name);

  app.use(requestLogger);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin))
          return callback(null, true);

        return callback(
          Object.assign(new Error('CORS origin denied'), {
            statusCode: 403,
            publicMessage: 'Request origin is not allowed',
            isOperational: true,
          })
        );
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Protection', 'X-Request-Id'],
      exposedHeaders: [
        'X-Request-Id',
        'X-Error-Id',
        'RateLimit',
        'RateLimit-Policy',
        'Retry-After',
      ],
      maxAge: 600,
    })
  );

  // Probes must work without a session or a rate-limit database round trip.
  const readiness = createReadiness({
    state: app.locals.operationsState,
    storageRoot: uploadsRootPath,
    email: app.locals.emailProvider,
    ...options.healthChecks,
  });

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  );

  app.get('/api/ready', async (_req, res, next) => {
    try {
      const result = await readiness();
      res.setHeader('Cache-Control', 'no-store');
      res.status(result.status === 'ready' ? 200 : 503).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res, next) => {
    if (app.locals.operationsState.draining)
      return res
        .status(503)
        .json({ error: { message: 'Server is shutting down' } });
    return next();
  });

  app.use(
    '/api',
    csrfProtection({
      allowedOrigins: config.allowedOrigins,
      enforce: options.enforceCsrf ?? config.csrfProtectionEnabled,
    })
  );

  const sessionStore =
    options.sessionStore ||
    MongoStore.create({
      mongoUrl: config.mongoUri,
      ttl: Math.ceil(config.sessionTtlMs / 1000),
      touchAfter: 300,
    });

  app.locals.sessionStore = sessionStore;
  sessionStore.on?.('error', () =>
    logger.error({
      event: 'SESSION_STORE_FAILED',
      component: 'database',
      outcome: 'failure',
    })
  );

  app.use(
    session({
      name: sessionCookieName,
      secret:
        config.sessionSecret || 'test-only-session-secret-at-least-32-chars',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: sessionStore,
      cookie: sessionCookieOptions,
    })
  );

  app.locals.sessionCookieName = sessionCookieName;
  app.locals.sessionCookieOptions = sessionCookieOptions;

  const loginLimiter = rateLimit({
    store: rateStore('login'),
    windowMs: config.authRateLimitWindowMs,
    max: config.authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== 'POST',
    handler: (_req, _res, next) =>
      next(
        Object.assign(
          new Error('Too many authentication attempts. Try again later.'),
          {
            statusCode: 429,
            publicMessage: 'Too many authentication attempts. Try again later.',
            isOperational: true,
          }
        )
      ),
  });

  const resetLimiter = rateLimit({
    store: rateStore('reset'),
    windowMs: config.authRateLimitWindowMs,
    max: config.passwordResetRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== 'POST',
    handler: (_req, _res, next) =>
      next(
        Object.assign(
          new Error('Too many password reset attempts. Try again later.'),
          {
            statusCode: 429,
            publicMessage: 'Too many password reset attempts. Try again later.',
            isOperational: true,
          }
        )
      ),
  });

  const apiLimiter = rateLimit({
    store: rateStore('api'),
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });

  if (options.enforceRateLimit ?? config.nodeEnv !== 'test') {
    app.use(['/api/auth/login', '/api/auth/register'], loginLimiter);
    app.use(
      ['/api/auth/forgot-password', '/api/auth/reset-password'],
      resetLimiter
    );
    app.use(apiLimiter);
  }

  app.use(express.json({ limit: '10mb', strict: true }));
  app.use(
    express.urlencoded({
      extended: false,
      limit: '100kb',
      parameterLimit: 100,
    })
  );

  app.use('/api', inputSafety);

  // Export the job queue for testing and direct access.
  app.locals.jobQueue = jobQueue;

  app.use('/api/auth', authRoutes);

  // Protected routes are gated explicitly by middleware at the router boundary
  // instead of a global path whitelist. This is easier to reason about and easier
  // to extend as the app grows.
  app.get('/api/search', requireAuth, workflowAsyncHandler(searchWorkspace));
  app.use('/api/trades', requireAuth, tradeRoutes);
  app.use('/api/accounts', requireAuth, accountRoutes);
  app.use('/api/import', requireAuth, importRoutes);
  app.use('/api/journal', requireAuth, journalRoutes);
  app.use('/api/knowledge', requireAuth, knowledgeRoutes);
  app.use('/api/tags', requireAuth, tagRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/reports', requireAuth, reportsRoutes);
  app.use('/api/strategies', requireAuth, strategyRoutes);
  app.use('/api/playbooks', requireAuth, playbookRoutes);
  app.use('/api/risk', requireAuth, riskRoutes);
  app.use('/api/replay', requireAuth, replayRoutes);
  app.use(
    '/api/replay',
    requireAuth,
    createReplayRunRouter(options.replayService)
  );

  app.use('/api/backtest', requireAuth, backtestRoutes);
  app.use(
    '/api/market-data',
    requireAuth,
    createMarketDataRouter(options.marketDataService)
  );

  app.use('/api/ai', requireAuth, aiRoutes);
  app.use('/api/agents', requireAuth, agentsRoutes);
  app.use('/api/backup', requireAuth, backupRoutes);
  app.use('/api/settings', requireAuth, appSettingsRoutes);
  app.use('/api/jobs', requireAuth, jobsRoutes);
  app.use('/api/admin', requireAuth, adminRoutes);
  app.use('/api/account-security', requireAuth, accountSecurityRoutes);
  app.use('/api/broker-connections', requireAuth, brokerConnectionRoutes);
  app.use(
    '/api/instrument-specifications',
    requireAuth,
    instrumentSpecificationRoutes
  );

  // Serves uploaded trade screenshots — /uploads/screenshots/<file>
  app.use(
    '/uploads/screenshots/:filename',
    requireAuth,
    async (req, res, next) => {
      try {
        const url = `/uploads/screenshots/${req.params.filename}`;
        if (
          !(await Trade.exists({ userId: req.user.id, 'screenshots.url': url }))
        )
          return res
            .status(404)
            .json({ error: { message: 'Screenshot not found' } });

        return res.sendFile(req.params.filename, {
          root: `${uploadsRootPath}/screenshots`,
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  app.use('/uploads/media/:filename', requireAuth, async (req, res, next) => {
    try {
      const url = `/uploads/media/${req.params.filename}`;
      const owned = await Promise.all([
        Strategy.exists({ userId: req.user.id, 'screenshots.url': url }),
        Playbook.exists({ userId: req.user.id, 'screenshots.url': url }),
      ]);

      if (!owned.some(Boolean))
        return res.status(404).json({ error: { message: 'Media not found' } });

      return res.sendFile(req.params.filename, {
        root: `${uploadsRootPath}/media`,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
