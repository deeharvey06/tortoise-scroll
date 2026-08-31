import express from 'express';
import cors from 'cors';
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
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { uploadsRootPath } from './middleware/upload.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    })
  );
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serves uploaded trade screenshots — /uploads/screenshots/<file>
  app.use('/uploads', express.static(uploadsRootPath));

  app.use('/api/trades', tradeRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/journal', journalRoutes);
  app.use('/api/tags', tagRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/strategies', strategyRoutes);
  app.use('/api/playbooks', playbookRoutes);
  app.use('/api/risk', riskRoutes);
  app.use('/api/replay', replayRoutes);
  app.use('/api/backtest', backtestRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/agents', agentsRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/settings', appSettingsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
