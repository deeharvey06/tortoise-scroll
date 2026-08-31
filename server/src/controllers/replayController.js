import Trade from '../models/Trade.js';
import { buildTradeQuery } from '../services/tradeService.js';
import * as marketDataService from '../services/marketDataService.js';

/**
 * Returns the ordered set of trades for a replay session (a day) plus
 * whether a market-data provider is available for price charting. Trades
 * include their raw executions so the replay UI can plot every real fill —
 * never an invented price path.
 */
export async function getSession(req, res) {
  const { date, ...rest } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('date query param (YYYY-MM-DD) is required');
  }
  const dateFrom = new Date(`${date}T00:00:00.000Z`);
  const dateTo = new Date(`${date}T23:59:59.999Z`);

  const query = buildTradeQuery({ ...rest, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() });
  const trades = await Trade.find(query).sort({ entryTime: 1 }).lean();

  res.json({
    date,
    trades,
    marketData: { configured: marketDataService.isConfigured(), provider: marketDataService.getProviderName() },
  });
}

export function getMarketDataStatus(req, res) {
  res.json({ configured: marketDataService.isConfigured(), provider: marketDataService.getProviderName() });
}

export default { getSession, getMarketDataStatus };
