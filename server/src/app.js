import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

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
import { jobQueue } from './queue/jobQueue.js';
import * as jobHandlers from './queue/handlers.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { uploadsRootPath } from './middleware/upload.js';
import { requireAuth } from './middleware/auth.js';
import requestLogger from './middleware/requestLogger.js';

// Register job handlers
jobQueue.register('import-trades', jobHandlers.handleTradeImport);
jobQueue.register(
  'performance-analysis',
  jobHandlers.handlePerformanceAnalysis,
);
jobQueue.register('risk-assessment', jobHandlers.handleRiskAssessment);
jobQueue.register('auto-tagger', jobHandlers.handleAutoTagger);

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
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
  app.use('/api/jobs', jobsRoutes);

  // Serves uploaded trade screenshots — /uploads/screenshots/<file>
  app.use('/uploads', express.static(uploadsRootPath));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
