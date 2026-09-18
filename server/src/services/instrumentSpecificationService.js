import InstrumentSpecification from '../models/InstrumentSpecification.js';

const BUILTIN_SPECS = Object.freeze({
  ES: {
    symbol: 'ES',
    assetType: 'future',
    tickSize: 0.25,
    tickValue: 12.5,
    pointValue: 50,
    contractMultiplier: 50,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  MES: {
    symbol: 'MES',
    assetType: 'future',
    tickSize: 0.25,
    tickValue: 1.25,
    pointValue: 5,
    contractMultiplier: 5,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  NQ: {
    symbol: 'NQ',
    assetType: 'future',
    tickSize: 0.25,
    tickValue: 5,
    pointValue: 20,
    contractMultiplier: 20,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  MNQ: {
    symbol: 'MNQ',
    assetType: 'future',
    tickSize: 0.25,
    tickValue: 0.5,
    pointValue: 2,
    contractMultiplier: 2,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  YM: {
    symbol: 'YM',
    assetType: 'future',
    tickSize: 1,
    tickValue: 5,
    pointValue: 5,
    contractMultiplier: 5,
    currency: 'USD',
    exchange: 'CBOT',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  MYM: {
    symbol: 'MYM',
    assetType: 'future',
    tickSize: 1,
    tickValue: 0.5,
    pointValue: 0.5,
    contractMultiplier: 0.5,
    currency: 'USD',
    exchange: 'CBOT',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  RTY: {
    symbol: 'RTY',
    assetType: 'future',
    tickSize: 0.1,
    tickValue: 5,
    pointValue: 50,
    contractMultiplier: 50,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  M2K: {
    symbol: 'M2K',
    assetType: 'future',
    tickSize: 0.1,
    tickValue: 0.5,
    pointValue: 5,
    contractMultiplier: 5,
    currency: 'USD',
    exchange: 'CME',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  CL: {
    symbol: 'CL',
    assetType: 'future',
    tickSize: 0.01,
    tickValue: 10,
    pointValue: 1000,
    contractMultiplier: 1000,
    currency: 'USD',
    exchange: 'NYMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  MCL: {
    symbol: 'MCL',
    assetType: 'future',
    tickSize: 0.01,
    tickValue: 1,
    pointValue: 100,
    contractMultiplier: 100,
    currency: 'USD',
    exchange: 'NYMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  GC: {
    symbol: 'GC',
    assetType: 'future',
    tickSize: 0.1,
    tickValue: 10,
    pointValue: 100,
    contractMultiplier: 100,
    currency: 'USD',
    exchange: 'COMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  MGC: {
    symbol: 'MGC',
    assetType: 'future',
    tickSize: 0.1,
    tickValue: 1,
    pointValue: 10,
    contractMultiplier: 10,
    currency: 'USD',
    exchange: 'COMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  SI: {
    symbol: 'SI',
    assetType: 'future',
    tickSize: 0.005,
    tickValue: 25,
    pointValue: 5000,
    contractMultiplier: 5000,
    currency: 'USD',
    exchange: 'COMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  SIL: {
    symbol: 'SIL',
    assetType: 'future',
    tickSize: 0.005,
    tickValue: 5,
    pointValue: 1000,
    contractMultiplier: 1000,
    currency: 'USD',
    exchange: 'COMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  HG: {
    symbol: 'HG',
    assetType: 'future',
    tickSize: 0.0005,
    tickValue: 12.5,
    pointValue: 25000,
    contractMultiplier: 25000,
    currency: 'USD',
    exchange: 'COMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  NG: {
    symbol: 'NG',
    assetType: 'future',
    tickSize: 0.001,
    tickValue: 10,
    pointValue: 10000,
    contractMultiplier: 10000,
    currency: 'USD',
    exchange: 'NYMEX',
    timezone: 'America/New_York',
    session: 'eth',
  },
  ZB: {
    symbol: 'ZB',
    assetType: 'future',
    tickSize: 0.03125,
    tickValue: 31.25,
    pointValue: 1000,
    contractMultiplier: 1000,
    currency: 'USD',
    exchange: 'CBOT',
    timezone: 'America/Chicago',
    session: 'eth',
  },
  ZN: {
    symbol: 'ZN',
    assetType: 'future',
    tickSize: 0.015625,
    tickValue: 15.625,
    pointValue: 1000,
    contractMultiplier: 1000,
    currency: 'USD',
    exchange: 'CBOT',
    timezone: 'America/Chicago',
    session: 'eth',
  },
});

export function futureRoot(symbol) {
  const s = String(symbol || '')
    .toUpperCase()
    .replace(/^\//, '');
  const match = s.match(/^([A-Z0-9]+?)(?:[FGHJKMNQUVXZ]\d{1,2})?$/);
  return match?.[1] || s;
}
export function getBuiltinInstrumentSpecification(
  symbol,
  assetType = 'future'
) {
  if (assetType === 'option')
    return {
      symbol: String(symbol || '').toUpperCase(),
      assetType: 'option',
      tickSize: null,
      tickValue: null,
      pointValue: 100,
      contractMultiplier: 100,
      currency: 'USD',
      exchange: '',
      timezone: 'America/New_York',
      session: 'unspecified',
      source: 'system',
    };
  if (assetType !== 'future')
    return {
      symbol: String(symbol || '').toUpperCase(),
      assetType,
      tickSize: null,
      tickValue: null,
      pointValue: 1,
      contractMultiplier: 1,
      currency: 'USD',
      exchange: '',
      timezone: 'America/New_York',
      session: 'unspecified',
      source: 'system',
    };
  const spec = BUILTIN_SPECS[futureRoot(symbol)];
  return spec ? { ...spec, source: 'system' } : null;
}
export function resolveInstrumentSpecificationSync({ symbol, assetType }) {
  return getBuiltinInstrumentSpecification(symbol, assetType);
}
export async function resolveInstrumentSpecification({
  userId,
  symbol,
  assetType,
}) {
  const normalizedSymbol =
    assetType === 'future'
      ? futureRoot(symbol)
      : String(symbol || '')
          .toUpperCase()
          .trim();
  const custom = await InstrumentSpecification.findOne({
    userId,
    symbol: normalizedSymbol,
    assetType,
    isActive: true,
  }).lean();
  return (
    custom || getBuiltinInstrumentSpecification(normalizedSymbol, assetType)
  );
}
export function listBuiltinInstrumentSpecifications() {
  return Object.values(BUILTIN_SPECS).map((x) => ({ ...x, source: 'system' }));
}

export async function enrichExecutionWithInstrumentSpecification(
  userId,
  execution
) {
  if (!execution || execution.multiplierSource === 'broker') return execution;
  const spec = await resolveInstrumentSpecification({
    userId,
    symbol: execution.symbol,
    assetType: execution.assetType,
  });
  if (!spec || !(Number(spec.contractMultiplier) > 0)) {
    const error = new Error(
      `No instrument specification is available for ${execution.symbol}`
    );
    error.code = 'INSTRUMENT_SPEC_REQUIRED';
    throw error;
  }
  return {
    ...execution,
    multiplier: Number(spec.contractMultiplier),
    multiplierSource: spec.source === 'user' ? 'user-spec' : 'contract-spec',
  };
}

export async function enrichExecutionsWithInstrumentSpecifications(
  userId,
  executions = []
) {
  const accepted = [];
  const rejected = [];
  for (const execution of executions) {
    try {
      accepted.push(
        await enrichExecutionWithInstrumentSpecification(userId, execution)
      );
    } catch (error) {
      rejected.push({
        execution,
        message: error.message,
        code: error.code || 'INSTRUMENT_SPEC_ERROR',
      });
    }
  }
  return { accepted, rejected };
}

export default {
  futureRoot,
  resolveInstrumentSpecification,
  resolveInstrumentSpecificationSync,
  getBuiltinInstrumentSpecification,
  listBuiltinInstrumentSpecifications,
  enrichExecutionWithInstrumentSpecification,
  enrichExecutionsWithInstrumentSpecifications,
};
