/**
 * Broker adapters. `mode: trade` preserves the existing completed-trade
 * import contract. `mode: execution` means the source contains fills and
 * must pass through the normalized execution ledger + reconstruction engine.
 */
export const BROKER_ADAPTERS = {
  generic: {
    label: 'Generic CSV',
    mode: 'trade',
    defaultMapping: {},
    parseDirection: (raw) => normalizeDirection(raw),
  },
  ninjatrader: {
    label: 'NinjaTrader',
    mode: 'trade',
    defaultMapping: {
      symbol: 'Instrument',
      direction: 'Market pos.',
      quantity: 'Qty',
      entryPrice: 'Entry price',
      exitPrice: 'Exit price',
      entryTime: 'Entry time',
      exitTime: 'Exit time',
      commission: 'Commission',
    },
    parseDirection: (raw) =>
      normalizeDirection(raw, { long: ['long'], short: ['short'] }),
  },
  tradestation: {
    label: 'TradeStation',
    mode: 'trade',
    defaultMapping: {
      symbol: 'Symbol',
      direction: 'Side',
      quantity: 'Quantity',
      entryPrice: 'Open Price',
      exitPrice: 'Close Price',
      entryTime: 'Open Date/Time',
      exitTime: 'Close Date/Time',
      commission: 'Commission',
      fees: 'Fees',
    },
    parseDirection: (raw) =>
      normalizeDirection(raw, {
        long: ['buy', 'long'],
        short: ['sell', 'short', 'sell short'],
      }),
  },
  thinkorswim: {
    label: 'Thinkorswim',
    mode: 'execution',
    defaultMapping: {
      symbol: 'Symbol',
      side: 'Side',
      quantity: 'Qty',
      price: 'Price',
      timestamp: 'Exec Time',
      positionEffect: 'Pos Effect',
      expiration: 'Exp',
      strike: 'Strike',
      optionType: 'Type',
      executionId: 'Exec ID',
      orderId: 'Order ID',
      commission: 'Commission',
      fees: 'Misc Fees',
    },
    parseDirection: (raw) =>
      normalizeDirection(raw, { long: ['bot', 'buy'], short: ['sld', 'sell'] }),
  },
  interactive_brokers: {
    label: 'Interactive Brokers',
    mode: 'trade',
    defaultMapping: {
      symbol: 'Symbol',
      direction: 'Buy/Sell',
      quantity: 'Quantity',
      entryPrice: 'T. Price',
      entryTime: 'Date/Time',
      commission: 'Comm/Fee',
    },
    parseDirection: (raw) =>
      normalizeDirection(raw, { long: ['buy', 'bot'], short: ['sell', 'sld'] }),
  },
};

function normalizeDirection(raw, overrides) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  const longWords = overrides?.long || ['long', 'buy', 'bot', 'b'];
  const shortWords = overrides?.short || ['short', 'sell', 'sld', 'ss', 's'];
  if (longWords.includes(v)) return 'long';
  if (shortWords.includes(v)) return 'short';
  return null;
}

export function getAdapter(brokerKey) {
  return BROKER_ADAPTERS[brokerKey] || BROKER_ADAPTERS.generic;
}

export function listAdapters() {
  return Object.entries(BROKER_ADAPTERS).map(([key, a]) => ({
    key,
    label: a.label,
    mode: a.mode,
  }));
}

export default { BROKER_ADAPTERS, getAdapter, listAdapters };
