import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
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
import backtestRoutes from './routes/backtestRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import agentsRoutes from './routes/agentsRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import appSettingsRoutes from './routes/appSettingsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import jobsRoutes from './routes/jobsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { jobQueue } from './queue/jobQueue.js';
import * as jobHandlers from './queue/handlers.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { uploadsRootPath } from './middleware/upload.js';
import { requireAuth } from './middleware/auth.js';
import requestLogger from './middleware/requestLogger.js';
import { getConfig } from './config/index.js';
import Trade from './models/Trade.js';
import Strategy from './models/Strategy.js';
import Playbook from './models/Playbook.js';

// Register job handlers
jobQueue.register('import-trades', jobHandlers.handleTradeImport);
jobQueue.register(
  'performance-analysis',
  jobHandlers.handlePerformanceAnalysis,
);
jobQueue.register('risk-assessment', jobHandlers.handleRiskAssessment);
jobQueue.register('auto-tagger', jobHandlers.handleAutoTagger);

export function createApp(options = {}) {
  const app = express();
  const config = getConfig();
  if (config.nodeEnv !== 'test' && config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  }
  const sessionCookieName = 'tortoise.sid';
  const sessionCookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: config.sessionTtlMs,
    path: '/',
  };

  if (config.nodeEnv === 'production') app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({ origin: config.allowedOrigins, credentials: true }),
  );
  app.use(session({
    name: sessionCookieName,
    secret: config.sessionSecret || 'test-only-session-secret-at-least-32-chars',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: options.sessionStore || MongoStore.create({ mongoUrl: config.mongoUri, ttl: Math.ceil(config.sessionTtlMs / 1000), touchAfter: 300 }),
    cookie: sessionCookieOptions,
  }));
  app.locals.sessionCookieName = sessionCookieName;
  app.locals.sessionCookieOptions = sessionCookieOptions;
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100000 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100000 : 200,
    standardHeaders: true,
    legacyHeaders: false,
  });

  if (process.env.NODE_ENV !== 'test') {
    app.use('/api/auth', authLimiter);
    app.use(apiLimiter);
  }
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(requestLogger);

  // Export the job queue for testing and direct access
  app.locals.jobQueue = jobQueue;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);

  // Protected routes are gated explicitly by middleware at the router boundary
  // instead of a global path whitelist. This is easier to reason about and easier
  // to extend as the app grows.
  app.use('/api/trades', requireAuth, tradeRoutes);
  app.use('/api/accounts', requireAuth, accountRoutes);
  app.use('/api/import', requireAuth, importRoutes);
  app.use('/api/journal', requireAuth, journalRoutes);
  app.use('/api/tags', requireAuth, tagRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);
  app.use('/api/reports', requireAuth, reportsRoutes);
  app.use('/api/strategies', requireAuth, strategyRoutes);
  app.use('/api/playbooks', requireAuth, playbookRoutes);
  app.use('/api/risk', requireAuth, riskRoutes);
  app.use('/api/replay', requireAuth, replayRoutes);
  app.use('/api/backtest', requireAuth, backtestRoutes);
  app.use('/api/ai', requireAuth, aiRoutes);
  app.use('/api/agents', requireAuth, agentsRoutes);
  app.use('/api/backup', requireAuth, backupRoutes);
  app.use('/api/settings', requireAuth, appSettingsRoutes);
  app.use('/api/jobs', requireAuth, jobsRoutes);
  app.use('/api/admin', requireAuth, adminRoutes);

  // Serves uploaded trade screenshots — /uploads/screenshots/<file>
  app.use('/uploads/screenshots/:filename', requireAuth, async (req, res, next) => {
    try {
      const url = `/uploads/screenshots/${req.params.filename}`;
      if (!(await Trade.exists({ userId: req.user.id, 'screenshots.url': url }))) return res.status(404).json({ error: { message: 'Screenshot not found' } });
      return res.sendFile(req.params.filename, { root: `${uploadsRootPath}/screenshots` });
    } catch (error) { return next(error); }
  });
  app.use('/uploads/media/:filename', requireAuth, async (req, res, next) => {
    try {
      const url = `/uploads/media/${req.params.filename}`;
      const owned = await Promise.all([Strategy.exists({ userId: req.user.id, 'screenshots.url': url }), Playbook.exists({ userId: req.user.id, 'screenshots.url': url })]);
      if (!owned.some(Boolean)) return res.status(404).json({ error: { message: 'Media not found' } });
      return res.sendFile(req.params.filename, { root: `${uploadsRootPath}/media` });
    } catch (error) { return next(error); }
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
