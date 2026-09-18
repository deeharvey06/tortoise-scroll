export class MarketDataError extends Error {
  constructor(code, message, statusCode = 422, details = undefined) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function fail(code, message, statusCode, details) {
  throw new MarketDataError(code, message, statusCode, details);
}

export function safeProviderError(error) {
  return error instanceof MarketDataError
    ? error
    : new MarketDataError(
        'MARKET_DATA_PROVIDER_ERROR',
        'The market-data provider could not read the requested data.',
        503
      );
}
