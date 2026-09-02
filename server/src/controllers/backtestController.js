import BacktestConfig from '../models/BacktestConfig.js';
import * as marketDataService from '../services/marketDataService.js';
import { runBacktest } from '../engines/backtestEngine.js';
import { ownedFilter, ownedPayload, withoutOwnership } from '../utils/ownership.js';

export async function getStatus(req, res) {
  res.json({ configured: marketDataService.isConfigured(), provider: marketDataService.getProviderName() });
}

export async function listConfigs(req, res) {
  const configs = await BacktestConfig.find(ownedFilter(req)).sort({ updatedAt: -1 }).lean();
  res.json(configs);
}

export async function getConfig(req, res) {
  const config = await BacktestConfig.findOne(ownedFilter(req, { _id: req.params.id })).lean();
  if (!config) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  res.json(config);
}

export async function createConfig(req, res) {
  const config = await BacktestConfig.create(ownedPayload(req, req.body));
  res.status(201).json(config);
}

export async function updateConfig(req, res) {
  const config = await BacktestConfig.findOneAndUpdate(ownedFilter(req, { _id: req.params.id }), withoutOwnership(req.body), { new: true, runValidators: true });
  if (!config) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  res.json(config);
}

export async function deleteConfig(req, res) {
  const deleted = await BacktestConfig.findOneAndDelete(ownedFilter(req, { _id: req.params.id }));
  if (!deleted) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  res.status(204).send();
}

/**
 * Runs a saved config against real bars from the market data provider.
 * If no provider is connected this returns 501 with a clear explanation —
 * it never falls back to synthetic data.
 */
export async function runConfig(req, res) {
  const config = await BacktestConfig.findOne(ownedFilter(req, { _id: req.params.id }));
  if (!config) {
    res.status(404);
    throw new Error('Backtest config not found');
  }

  if (!marketDataService.isConfigured()) {
    res.status(501);
    throw new Error(
      'No market data provider is connected, so this backtest cannot run against real historical prices. ' +
        'The configuration is saved and will run as soon as a provider is set up in server/.env.'
    );
  }

  const bars = await marketDataService.fetchCandles({
    symbol: config.symbol,
    timeframe: config.timeframe,
    from: config.dateFrom,
    to: config.dateTo,
  });

  const result = runBacktest({
    bars,
    direction: config.direction,
    entryRule: config.entryRule,
    stopLossPct: config.stopLossPct,
    takeProfitPct: config.takeProfitPct,
    positionSize: config.positionSize,
    commission: config.commission,
    slippage: config.slippage,
  });

  config.lastResult = result;
  config.lastRunAt = new Date();
  await config.save();

  res.json(result);
}

export default { getStatus, listConfigs, getConfig, createConfig, updateConfig, deleteConfig, runConfig };
