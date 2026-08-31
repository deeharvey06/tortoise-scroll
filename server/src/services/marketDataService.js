/**
 * Abstraction over historical market-data providers (candlestick bars).
 * The app ships with NO provider connected — there is no free, no-signup
 * source of historical OHLC data we can bundle, and fabricating bars would
 * violate the project's core rule against faking market data. This module
 * exists so Replay and Backtesting can be built against a stable interface
 * now, and light up the moment a real provider is wired in later.
 *
 * To connect a real provider: implement `fetchCandles` for it below (e.g.
 * Alpaca, Polygon.io, Twelve Data), set MARKET_DATA_PROVIDER in .env to its
 * key, and provide any required API key env vars. No other code changes
 * needed — controllers only call the functions exported here.
 */

const PROVIDER = process.env.MARKET_DATA_PROVIDER || 'none';

export function getProviderName() {
  return PROVIDER;
}

export function isConfigured() {
  return PROVIDER !== 'none' && PROVIDER !== '';
}

/**
 * Fetches OHLCV bars for a symbol/timeframe/date range.
 * @returns {Promise<Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>>}
 * @throws if no provider is configured — callers must handle this and tell
 * the user clearly, never substitute synthetic data.
 */
export async function fetchCandles({ symbol, timeframe, from, to }) {
  if (!isConfigured()) {
    const err = new Error(
      `No market data provider is configured (MARKET_DATA_PROVIDER=none). Historical price bars for ${symbol} are unavailable. ` +
        `Connect a provider in server/.env to enable Replay charts and Backtesting.`
    );
    err.code = 'MARKET_DATA_NOT_CONFIGURED';
    throw err;
  }
  // Real providers get implemented here, switched on PROVIDER. None exist
  // yet — isConfigured() guards against ever reaching this line today.
  throw new Error(`Market data provider "${PROVIDER}" has no implementation yet.`);
}

export default { getProviderName, isConfigured, fetchCandles };
