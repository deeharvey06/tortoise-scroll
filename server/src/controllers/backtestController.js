import { executeStrategy } from '../services/backtestService.js';
import {
  parseDefinition,
  BacktestError,
} from '../engines/backtest/definition.js';
import BacktestConfig from '../models/BacktestConfig.js';
import * as marketDataService from '../services/marketDataService.js';
import { runBacktest } from '../engines/backtestEngine.js';
import { ownedFilter, ownedPayload } from '../utils/ownership.js';

export async function getStatus(req, res) {
  res.json({
    configured: marketDataService.isConfigured(),
    provider: marketDataService.getProviderName(),
  });
}

export async function listConfigs(req, res) {
  const configs = await BacktestConfig.find(ownedFilter(req))
    .sort({ updatedAt: -1 })
    .lean();
  res.json(configs);
}

export async function getConfig(req, res) {
  const config = await BacktestConfig.findOne(
    ownedFilter(req, { _id: req.params.id })
  ).lean();
  if (!config) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  res.json(config);
}

const writable = [
  'name',
  'symbol',
  'timeframe',
  'dateFrom',
  'dateTo',
  'direction',
  'entryRule',
  'stopLossPct',
  'takeProfitPct',
  'positionSize',
  'commission',
  'slippage',
  'engineVersion',
  'datasetId',
  'strategyDefinition',
  'execution',
];
function payload(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BacktestError('Configuration must be an object.', 400);
  if (
    input.engineVersion !== undefined &&
    ![1, 2].includes(input.engineVersion)
  )
    throw new BacktestError('Invalid engine version.', 400);
  const values = Object.fromEntries(
    writable
      .filter((key) => Object.hasOwn(input, key))
      .map((key) => [key, input[key]])
  );
  const merged = { ...previous, ...values };
  if (merged.engineVersion === 2) {
    parseDefinition(merged.strategyDefinition, merged.execution);
    if (
      !merged.datasetId ||
      !merged.name ||
      !merged.symbol ||
      !Number.isFinite(Date.parse(merged.dateFrom)) ||
      !Number.isFinite(Date.parse(merged.dateTo)) ||
      Date.parse(merged.dateFrom) >= Date.parse(merged.dateTo)
    )
      throw new BacktestError(
        'Name, dataset, symbol and an increasing timestamp range are required.',
        400
      );
  }
  return values;
}
export async function createConfig(req, res) {
  const config = await BacktestConfig.create(
    ownedPayload(req, payload(req.body))
  );
  res.status(201).json(config);
}
export async function updateConfig(req, res) {
  const previous = await BacktestConfig.findOne(
    ownedFilter(req, { _id: req.params.id })
  ).lean();
  if (!previous) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  const config = await BacktestConfig.findOneAndUpdate(
    ownedFilter(req, { _id: req.params.id }),
    {
      $set: {
        ...payload(req.body, previous),
        lastResult: null,
        lastRunAt: null,
      },
      $inc: { __v: 1 },
    },
    { new: true, runValidators: true }
  );
  if (!config) {
    res.status(404);
    throw new Error('Backtest config not found');
  }
  res.json(config);
}

export async function deleteConfig(req, res) {
  const deleted = await BacktestConfig.findOneAndDelete(
    ownedFilter(req, { _id: req.params.id })
  );
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
  const config = await BacktestConfig.findOne(
    ownedFilter(req, { _id: req.params.id })
  );
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

  if (config.engineVersion === 2) {
    const result = await executeStrategy(config, req.user.id);
    const saved = await BacktestConfig.findOneAndUpdate(
      ownedFilter(req, { _id: config._id, __v: config.__v }),
      { $set: { lastResult: result, lastRunAt: new Date() } },
      { new: true }
    );
    if (!saved)
      throw new BacktestError(
        'Configuration changed during simulation. Run the saved configuration again.',
        409
      );
    return res.json(result);
  }

  const bars = await marketDataService.fetchCandles({
    userId: req.user.id,
    // The existing engine calculates price difference × quantity, with no
    // contract multiplier. Do not silently activate incorrect futures P&L.
    requireContractMultiplier: 1,
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

export default {
  getStatus,
  listConfigs,
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  runConfig,
};
