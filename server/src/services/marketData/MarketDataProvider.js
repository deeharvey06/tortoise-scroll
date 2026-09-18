import { normalizeSymbol, normalizeTimestamp } from './time.js';
import { resolveInstrumentSpecification } from '../instrumentSpecificationService.js';
import { fail } from './errors.js';

/**
 * Adapter contract. describe() returns owned, versioned dataset metadata plus a
 * private source handle. fetchCandles() returns source rows, not trusted bars.
 * All adapters pass through the same normalizer/cache/service before consumption.
 */
export class MarketDataProvider {
  constructor(
    name,
    { contractResolver = resolveInstrumentSpecification } = {}
  ) {
    this.name = name;
    this.contractResolver = contractResolver;
  }
  normalizeSymbol(symbol) {
    return normalizeSymbol(symbol);
  }
  normalizeTimestamp(value, context) {
    return normalizeTimestamp(value, context);
  }
  getTradingCalendar(dataset) {
    return dataset.calendar;
  }
  getSessionHours(dataset) {
    return dataset.calendar.sessions;
  }
  async getContractMetadata(userId, dataset) {
    return this.contractResolver({
      userId,
      symbol: dataset.symbol,
      assetType: dataset.assetType,
    });
  }
  async listDatasets() {
    fail(
      'MARKET_DATA_NOT_IMPLEMENTED',
      'Provider catalog is not implemented.',
      501
    );
  }
  async describe() {
    fail(
      'MARKET_DATA_NOT_IMPLEMENTED',
      'Provider dataset lookup is not implemented.',
      501
    );
  }
  async fetchCandles() {
    fail(
      'MARKET_DATA_NOT_IMPLEMENTED',
      'Provider candle loading is not implemented.',
      501
    );
  }
}
