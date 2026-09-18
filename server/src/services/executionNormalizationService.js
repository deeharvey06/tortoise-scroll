import { createHash } from 'crypto';

import { resolveInstrumentSpecificationSync } from './instrumentSpecificationService.js';

function cleanNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace(/[$,+]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeSide(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (['buy', 'bot', 'bought', 'b'].includes(value)) return 'buy';
  if (['sell', 'sld', 'sold', 's'].includes(value)) return 'sell';
  return null;
}

function normalizePositionEffect(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return 'unknown';
  if (value.includes('open')) return 'open';
  if (value.includes('close')) return 'close';
  return 'unknown';
}

function normalizeStatus(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (!value) return 'filled';
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('reject')) return 'rejected';
  if (value.includes('fill') || value.includes('execut')) return 'filled';
  return 'unknown';
}

export function inferAssetType({
  symbol,
  expiration,
  strike,
  optionType,
  spread,
}) {
  const s = String(symbol || '').trim();
  if (expiration || strike !== null || optionType) return 'option';
  if (s.startsWith('/')) return 'future';
  if (/FUTURE/i.test(String(spread || ''))) return 'future';
  return 'equity';
}

export function resolveMultiplier({ assetType, symbol, explicitMultiplier }) {
  const explicit = cleanNumber(explicitMultiplier);
  if (explicit && explicit > 0)
    return { multiplier: explicit, source: 'broker' };
  const spec = resolveInstrumentSpecificationSync({ symbol, assetType });
  if (!spec) return { multiplier: null, source: null };
  return { multiplier: spec.contractMultiplier, source: 'contract-spec' };
}

export function createInstrumentKey({
  symbol,
  assetType,
  expiration,
  strike,
  optionType,
}) {
  return [
    String(symbol || '')
      .toUpperCase()
      .trim(),
    assetType || 'other',
    expiration ? new Date(expiration).toISOString().slice(0, 10) : '',
    strike ?? '',
    optionType || '',
  ].join('|');
}

export function computeExecutionKey(execution) {
  if (execution.executionId) return `id:${execution.executionId}`;
  const payload = [
    execution.broker,
    execution.account || '',
    execution.orderId || '',
    execution.instrumentKey,
    execution.side,
    execution.quantity,
    execution.price,
    new Date(execution.timestamp).toISOString(),
    execution.positionEffect,
  ].join('|');
  return `hash:${createHash('sha256').update(payload).digest('hex')}`;
}

export function normalizeExecution(input) {
  const errors = [];
  const warnings = [];
  const side = normalizeSide(input.side);
  const quantity = cleanNumber(input.quantity);
  const price = cleanNumber(input.price);
  const timestamp = input.timestamp ? new Date(input.timestamp) : null;
  const strike = cleanNumber(input.strike);
  const expiration = input.expiration ? new Date(input.expiration) : null;
  const optionTypeRaw = String(input.optionType || '')
    .trim()
    .toLowerCase();
  const optionType = optionTypeRaw.startsWith('c')
    ? 'call'
    : optionTypeRaw.startsWith('p')
      ? 'put'
      : null;
  const status = normalizeStatus(input.status);
  const assetType =
    input.assetType ||
    inferAssetType({
      symbol: input.symbol,
      expiration:
        expiration && !Number.isNaN(expiration.getTime()) ? expiration : null,
      strike,
      optionType,
      spread: input.spread,
    });
  const multiplierInfo = resolveMultiplier({
    assetType,
    symbol: input.symbol,
    explicitMultiplier: input.multiplier,
  });

  if (!input.symbol) errors.push('Missing symbol');
  if (!side)
    errors.push(`Unrecognized or missing side ("${input.side ?? ''}")`);
  if (!(quantity > 0)) errors.push('Missing or invalid quantity');
  if (price === null) errors.push('Missing or invalid execution price');
  if (!timestamp || Number.isNaN(timestamp.getTime()))
    errors.push('Missing or unparseable execution time');
  if (expiration && Number.isNaN(expiration.getTime()))
    errors.push('Invalid option expiration');
  if (assetType === 'future' && !multiplierInfo.multiplier) {
    warnings.push(
      `Unresolved futures multiplier for ${input.symbol}; an instrument specification is required before persistence`
    );
  }
  if (status === 'cancelled' || status === 'rejected') {
    warnings.push(
      `${status} row is not an execution and will not affect positions`
    );
  }

  if (errors.length) return { execution: null, errors, warnings };

  const execution = {
    broker: String(input.broker || 'generic').toLowerCase(),
    account: String(input.account || ''),
    executionId: String(input.executionId || '').trim(),
    orderId: String(input.orderId || '').trim(),
    symbol: String(input.symbol).toUpperCase().trim(),
    assetType,
    side,
    quantity,
    price,
    timestamp,
    commission: cleanNumber(input.commission) ?? 0,
    fees: cleanNumber(input.fees) ?? 0,
    multiplier: multiplierInfo.multiplier,
    multiplierSource: multiplierInfo.source,
    expiration:
      expiration && !Number.isNaN(expiration.getTime()) ? expiration : null,
    strike,
    optionType,
    positionEffect: normalizePositionEffect(input.positionEffect),
    status,
    rawBrokerMetadata: input.rawBrokerMetadata || {},
    rawRowNumber: input.rawRowNumber ?? null,
  };
  execution.instrumentKey = createInstrumentKey(execution);
  execution.executionKey = computeExecutionKey(execution);
  return { execution, errors: [], warnings };
}

export default {
  normalizeExecution,
  computeExecutionKey,
  createInstrumentKey,
  inferAssetType,
  resolveMultiplier,
};
