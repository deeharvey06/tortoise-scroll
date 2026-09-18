import { LocalCsvProvider } from './marketData/LocalCsvProvider.js';
import { CandleCache } from './marketData/CandleCache.js';
import { normalizeCandles, selectRange } from './marketData/normalizer.js';
import {
  normalizeTimestamp,
  TIMEFRAMES,
  SESSION_KINDS,
} from './marketData/time.js';
import { fail, safeProviderError } from './marketData/errors.js';

function requireOwner(userId) {
  const owner = String(userId || '');
  if (!/^[a-f0-9]{24}$/i.test(owner))
    fail(
      'MARKET_DATA_OWNER_REQUIRED',
      'An authenticated owner is required.',
      401
    );
  return owner.toLowerCase();
}

/**
 * Canonical range contract: [from,to), UTC candle starts; explicit availability
 * and integrity diagnostics. Providers never feed consumers directly.
 */
export function createMarketDataService({
  provider = null,
  providerName = provider?.name || 'none',
  cache = new CandleCache(),
} = {}) {
  const requireProvider = () => {
    if (!provider)
      fail(
        'MARKET_DATA_NOT_CONFIGURED',
        'No supported market-data provider is configured. Configure a local CSV catalog to load real historical candles.',
        503
      );
    return provider;
  };
  const service = {
    getProviderName: () => providerName,
    isConfigured: () => Boolean(provider),
    async getStatus(userId) {
      requireOwner(userId);
      return {
        configured: Boolean(provider),
        provider: providerName,
        state: provider ? 'configured' : 'unconfigured',
      };
    },
    async listDatasets(userId) {
      const owner = requireOwner(userId);
      try {
        return await requireProvider().listDatasets(owner);
      } catch (error) {
        throw safeProviderError(error);
      }
    },
    async getCandles(input) {
      const userId = requireOwner(input.userId);
      const adapter = requireProvider();
      const symbol = adapter.normalizeSymbol(input.symbol);
      const timeframe = input.timeframe;
      if (!Object.hasOwn(TIMEFRAMES, timeframe))
        fail(
          'MARKET_DATA_UNSUPPORTED_TIMEFRAME',
          'Unsupported timeframe.',
          400
        );
      const session = input.session || 'all';
      if (!['all', ...SESSION_KINDS].includes(session))
        fail(
          'MARKET_DATA_UNSUPPORTED_SESSION',
          'Unsupported session filter.',
          400
        );
      if (
        input.datasetId !== undefined &&
        (typeof input.datasetId !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,64}$/.test(input.datasetId))
      )
        fail('MARKET_DATA_INVALID_REQUEST', 'Invalid datasetId.', 400);
      const from = normalizeTimestamp(input.from);
      const to = normalizeTimestamp(input.to);
      if (from >= to)
        fail(
          'MARKET_DATA_INVALID_RANGE',
          'from must precede to; ranges are half-open [from,to).',
          400
        );
      try {
        const description = await adapter.describe({
          userId,
          datasetId: input.datasetId,
          symbol,
          timeframe,
        });
        const { dataset, revision } = description;
        const calendar = adapter.getTradingCalendar(dataset);
        if (from < calendar.from || to > calendar.to)
          fail(
            'MARKET_DATA_RANGE_UNAVAILABLE',
            'Requested range exceeds the declared calendar coverage. No assumptions are made about uncovered dates.',
            422,
            { coverage: { from: calendar.from, to: calendar.to } }
          );
        // Cache canonical source data: identical AND overlapping ranges avoid
        // rereading/parsing the file. Revision includes metadata and file identity.
        const key = JSON.stringify([
          'candles-v2',
          userId,
          adapter.name,
          dataset.id,
          revision,
        ]);
        const normalized = await cache.getOrLoad(key, async () =>
          normalizeCandles(await adapter.fetchCandles(description), dataset)
        );
        const selected = selectRange(normalized, dataset, {
          from,
          to,
          session,
        });
        const contractMetadata = await adapter.getContractMetadata(
          userId,
          dataset
        );
        if (!contractMetadata)
          selected.diagnostics.warnings.push({
            code: 'CONTRACT_METADATA_UNAVAILABLE',
          });
        return {
          ...selected,
          request: { symbol, timeframe, from, to, session },
          dataset: {
            id: dataset.id,
            provider: adapter.name,
            revision,
            assetType: dataset.assetType,
            timezone: dataset.timezone,
            priceBasis: dataset.priceBasis,
            timestampConvention: 'start',
          },
          contractMetadata,
        };
      } catch (error) {
        throw safeProviderError(error);
      }
    },
    // Backward-compatible shape for the existing SMA engine. It must never run
    // silently on partial data. Canonical consumers use getCandles instead.
    async fetchCandles(input) {
      const result = await service.getCandles(input);
      if (
        input.requireContractMultiplier !== undefined &&
        result.contractMetadata?.contractMultiplier !==
          input.requireContractMultiplier
      )
        fail(
          'MARKET_DATA_UNSUPPORTED_CONTRACT',
          `This consumer requires a confirmed contract multiplier of ${input.requireContractMultiplier}; the dataset's contract metadata is missing or incompatible.`,
          422
        );
      if (result.state !== 'available')
        fail(
          'MARKET_DATA_INCOMPLETE',
          `Historical candles are ${result.state}; a complete non-empty range is required.`,
          422,
          result.diagnostics
        );
      return result.candles.map((candle) => ({
        ...candle,
        time: candle.timestamp,
      }));
    },
  };
  return service;
}

let configured;
let configurationKey;
function current() {
  const providerName = process.env.MARKET_DATA_PROVIDER || 'none';
  const root = process.env.MARKET_DATA_LOCAL_ROOT;
  const key = JSON.stringify([providerName, root]);
  if (key !== configurationKey) {
    configured = createMarketDataService({
      providerName,
      provider:
        providerName === 'local-csv' && root
          ? new LocalCsvProvider({ root })
          : null,
    });
    configurationKey = key;
  }
  return configured;
}
export const getProviderName = () => current().getProviderName();
export const isConfigured = () => current().isConfigured();
export const getStatus = (userId) => current().getStatus(userId);
export const listDatasets = (userId) => current().listDatasets(userId);
export const getCandles = (input) => current().getCandles(input);
export const fetchCandles = (input) => current().fetchCandles(input);
export default {
  getProviderName,
  isConfigured,
  getStatus,
  listDatasets,
  getCandles,
  fetchCandles,
};
