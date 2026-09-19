import * as market from './marketDataService.js';
import { runStrategyBacktest } from '../engines/backtestEngine.js';
import { BacktestError } from '../engines/backtest/definition.js';

export async function executeStrategy(config, userId, provider = market) {
  const data = await provider.getCandles({
    userId,
    datasetId: config.datasetId,
    symbol: config.symbol,
    timeframe: config.timeframe,
    from: config.dateFrom,
    to: config.dateTo,
    session: 'all',
  });

  if (data.state !== 'available')
    throw new BacktestError(
      `Historical data is ${data.state}; missing bars are never filled or skipped.`
    );

  if (data.candles.some((bar) => bar.endTimestamp > data.request.to))
    throw new BacktestError(
      'The requested range ends inside an unfinished candle.'
    );

  if (data.dataset.priceBasis !== 'unadjusted')
    throw new BacktestError(
      'Execution simulation requires unadjusted prices; adjusted data is unsupported.'
    );

  if (!data.contractMetadata?.currency)
    throw new BacktestError(
      'Contract currency metadata is required; no FX conversion is assumed.'
    );

  if (data.dataset.assetType === 'future') {
    if (!/^[A-Z0-9]{1,8}[FGHJKMNQUVXZ]\d{1,4}$/.test(data.request.symbol))
      throw new BacktestError(
        'Futures require an explicitly dated single-contract symbol; continuous/root contracts and rollover are unsupported.'
      );

    if (!Number.isInteger(config.execution.quantity))
      throw new BacktestError('Futures quantities must be whole contracts.');
  }

  if (!data.calendar?.sessions)
    throw new BacktestError('Dataset calendar is unavailable.');

  return runStrategyBacktest({
    bars: data.candles,
    strategy: config.strategyDefinition,
    execution: config.execution,
    contract: data.contractMetadata,
    sessionEnds: data.calendar.sessions.map((s) => s.end),
    provenance: {
      dataset: data.dataset,
      request: data.request,
      currency: data.contractMetadata.currency,
      timezone: data.dataset.timezone,
      diagnostics: data.diagnostics,
      sessionClosePolicy:
        'Declared calendar segment ends, not future candle inspection',
      indicatorWarmup:
        'Selected range only; EMA first-close seed, signals after period bars',
      timestamps:
        'UTC; intrabar event times are unknown and reported at bar close',
      pnlBasis:
        'Realized closed trades; open position shown separately; no currency conversion',
    },
  });
}
