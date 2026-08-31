import { createHash } from 'crypto';

/**
 * Deterministic fingerprint for duplicate detection on import. Built from
 * the fields that identify "the same trade" independent of which import
 * run produced it, so re-importing the same file (or an overlapping date
 * range from the same broker) doesn't create duplicate trades.
 */
export function computeRowHash({ accountId, symbol, direction, quantity, entryPrice, entryTime }) {
  const key = [
    String(accountId),
    String(symbol || '').toUpperCase(),
    String(direction || ''),
    String(quantity ?? ''),
    String(entryPrice ?? ''),
    entryTime ? new Date(entryTime).toISOString() : '',
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}

export default computeRowHash;
