/**
 * Broker adapters describe how a given export's columns typically map onto
 * our Trade fields, plus small per-broker parsing quirks (date formats,
 * how direction/side is expressed). They are a *starting point* the user
 * can freely override in the mapping step — real-world exports vary by
 * broker account settings and version, so we never claim perfect fidelity.
 * "Generic CSV" has no default mapping and requires the user to map columns
 * themselves.
 *
 * Target fields a mapping may point at (all optional except the required
 * set enforced in importService.validateRow):
 *   symbol, direction, quantity, entryPrice, exitPrice, entryTime, exitTime,
 *   fees, commission, stopLoss, notes
 */

export const BROKER_ADAPTERS = {
  generic: {
    label: 'Generic CSV',
    defaultMapping: {},
    parseDirection: (raw) => normalizeDirection(raw),
  },

  ninjatrader: {
    label: 'NinjaTrader',
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
    parseDirection: (raw) => normalizeDirection(raw, { long: ['long'], short: ['short'] }),
  },

  tradestation: {
    label: 'TradeStation',
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
    parseDirection: (raw) => normalizeDirection(raw, { long: ['buy', 'long'], short: ['sell', 'short', 'sell short'] }),
  },

  thinkorswim: {
    label: 'Thinkorswim',
    defaultMapping: {
      symbol: 'Symbol',
      direction: 'Side',
      quantity: 'Qty',
      entryPrice: 'Price',
      entryTime: 'Exec Time',
      commission: 'Commission',
      fees: 'Misc Fees',
    },
    // Thinkorswim's "Account Statement" export lists individual executions
    // rather than closed round-trips; full fill-pairing support lands with
    // the multi-fill import path in a later pass. For now the generic
    // mapping step lets a user reshape an already-paired export.
    parseDirection: (raw) => normalizeDirection(raw, { long: ['bot', 'buy'], short: ['sld', 'sell'] }),
  },

  interactive_brokers: {
    label: 'Interactive Brokers',
    defaultMapping: {
      symbol: 'Symbol',
      direction: 'Buy/Sell',
      quantity: 'Quantity',
      entryPrice: 'T. Price',
      entryTime: 'Date/Time',
      commission: 'Comm/Fee',
    },
    parseDirection: (raw) => normalizeDirection(raw, { long: ['buy', 'bot'], short: ['sell', 'sld'] }),
  },
};

function normalizeDirection(raw, overrides) {
  const v = String(raw || '').trim().toLowerCase();
  const longWords = overrides?.long || ['long', 'buy', 'bot', 'b'];
  const shortWords = overrides?.short || ['short', 'sell', 'sld', 'ss', 's'];
  if (longWords.includes(v)) return 'long';
  if (shortWords.includes(v)) return 'short';
  return null; // unrecognized — surfaced as a row error, never guessed
}

export function getAdapter(brokerKey) {
  return BROKER_ADAPTERS[brokerKey] || BROKER_ADAPTERS.generic;
}

export function listAdapters() {
  return Object.entries(BROKER_ADAPTERS).map(([key, a]) => ({ key, label: a.label }));
}

export default { BROKER_ADAPTERS, getAdapter, listAdapters };
