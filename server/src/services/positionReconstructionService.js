import { createHash } from 'crypto';
import Decimal from 'decimal.js';

const D = (v) => new Decimal(v ?? 0);

function splitExecution(execution, quantity, suffix) {
  const ratio = D(quantity).div(D(execution.quantity));
  return {
    ...execution,
    quantity: Number(quantity),
    commission: D(execution.commission).times(ratio).toNumber(),
    fees: D(execution.fees).times(ratio).toNumber(),
    executionKey: `${execution.executionKey}#${suffix}`,
    sourceExecutionKey: execution.executionKey,
  };
}

function sourcePositionKey(execution, direction) {
  const key = [
    execution.broker,
    execution.accountId || execution.account || '',
    execution.instrumentKey,
    execution.executionKey,
    direction,
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}

function createPosition(openingExecution, direction) {
  return {
    sourcePositionKey: sourcePositionKey(openingExecution, direction),
    broker: openingExecution.broker,
    accountId: openingExecution.accountId,
    instrumentKey: openingExecution.instrumentKey,
    symbol: openingExecution.symbol,
    assetType: openingExecution.assetType,
    expiration: openingExecution.expiration || null,
    strike: openingExecution.strike ?? null,
    optionType: openingExecution.optionType || null,
    multiplier: openingExecution.multiplier || 1,
    direction,
    openingQuantity: 0,
    remainingQuantity: 0,
    executions: [],
    warnings: [],
  };
}

function addOpening(position, execution) {
  position.executions.push(execution);
  position.openingQuantity = D(position.openingQuantity)
    .plus(D(execution.quantity))
    .toNumber();
  position.remainingQuantity = D(position.remainingQuantity)
    .plus(D(execution.quantity))
    .toNumber();
}

function addClosing(position, execution) {
  position.executions.push(execution);
  position.remainingQuantity = D(position.remainingQuantity)
    .minus(D(execution.quantity))
    .toNumber();
}

export function reconstructPositions(executions, { policy = 'fifo' } = {}) {
  if (policy !== 'fifo')
    throw new Error(`Unsupported reconstruction policy: ${policy}`);
  const valid = executions
    .filter((e) => e.status !== 'cancelled' && e.status !== 'rejected')
    .sort(
      (a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp) ||
        String(a.executionKey).localeCompare(String(b.executionKey))
    );

  const active = new Map();
  const positions = [];
  const warnings = [];
  const unresolvedExecutions = [];

  for (const original of valid) {
    let remaining = D(original.quantity);
    let fragment = 0;
    const key = original.instrumentKey;

    while (remaining.gt(0)) {
      let position = active.get(key);
      const executionDirection = original.side === 'buy' ? 'long' : 'short';

      if (!position) {
        if (original.positionEffect === 'close') {
          warnings.push(
            `Execution ${original.executionKey} is marked CLOSE but no prior open position exists for ${original.symbol}; left unresolved rather than guessing`
          );
          unresolvedExecutions.push(original.executionKey);
          remaining = D(0);
          continue;
        }
        position = createPosition(original, executionDirection);
        const opening = splitExecution(
          original,
          remaining.toNumber(),
          `open-${fragment}`
        );
        addOpening(position, opening);
        active.set(key, position);
        positions.push(position);
        remaining = D(0);
        continue;
      }

      const closesPosition =
        (position.direction === 'long' && original.side === 'sell') ||
        (position.direction === 'short' && original.side === 'buy');

      if (!closesPosition) {
        if (original.positionEffect === 'close') {
          warnings.push(
            `Execution ${original.executionKey} is marked CLOSE but its side does not close the active ${position.direction} position in ${original.symbol}; left unresolved`
          );
          unresolvedExecutions.push(original.executionKey);
          remaining = D(0);
          continue;
        }
        const opening = splitExecution(
          original,
          remaining.toNumber(),
          `scale-${fragment}`
        );
        addOpening(position, opening);
        remaining = D(0);
        continue;
      }

      if (original.positionEffect === 'open') {
        warnings.push(
          `Execution ${original.executionKey} is marked OPEN but its side would close the active ${position.direction} position in ${original.symbol}; left unresolved`
        );
        unresolvedExecutions.push(original.executionKey);
        remaining = D(0);
        continue;
      }

      const closeQty = Decimal.min(remaining, D(position.remainingQuantity));
      const closing = splitExecution(
        original,
        closeQty.toNumber(),
        `close-${fragment}`
      );
      addClosing(position, closing);
      remaining = remaining.minus(closeQty);
      fragment += 1;

      if (D(position.remainingQuantity).isZero()) {
        active.delete(key);
      }
      // If the same execution crosses through flat, the loop continues and
      // creates a new position in the opposite direction with the remainder.
    }
  }

  return {
    policy,
    positions: positions.map((p) => ({
      ...p,
      status: D(p.remainingQuantity).isZero() ? 'closed' : 'open',
    })),
    openPositions: [...active.values()].map((p) => p.sourcePositionKey),
    unresolvedExecutions,
    warnings,
  };
}

export function positionToTradePayload(position, accountId) {
  return {
    accountId,
    symbol: position.symbol,
    assetType: position.assetType,
    direction: position.direction,
    quantity: position.openingQuantity,
    entryPrice: 0,
    exitPrice: null,
    entryTime: position.executions[0]?.timestamp,
    exitTime: null,
    executions: position.executions.map((e) => ({
      side: e.side,
      price: e.price,
      quantity: e.quantity,
      time: e.timestamp,
      fees: e.fees || 0,
      commission: e.commission || 0,
      multiplier: e.multiplier || position.multiplier || 1,
      brokerExecutionKey: e.sourceExecutionKey || e.executionKey,
      executionId: e.executionId || '',
      orderId: e.orderId || '',
    })),
    multiplier: position.multiplier || 1,
    positionStatus: position.status,
    remainingQuantity: position.remainingQuantity,
    expiration: position.expiration,
    strike: position.strike,
    optionType: position.optionType,
    sourcePositionKey: position.sourcePositionKey,
    isDemoData: false,
  };
}

export default { reconstructPositions, positionToTradePayload };
