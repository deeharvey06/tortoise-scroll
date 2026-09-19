import Decimal from 'decimal.js';
import { roundTick } from './executionSimulator.js';
export function openPosition(
  price,
  bar,
  signal,
  strategy,
  policy,
  contract,
  atOpen
) {
  const long = strategy.direction === 'long';
  let stop = null;
  if (strategy.stop) {
    const distance =
      strategy.stop.type === 'percent'
        ? new Decimal(price).abs().times(strategy.stop.value).div(100)
        : new Decimal(strategy.stop.value || 0);
    stop =
      strategy.stop.type === 'signalExtreme'
        ? long
          ? signal.low
          : signal.high
        : new Decimal(price).plus(distance.times(long ? -1 : 1)).toNumber();
    stop = roundTick(stop, contract.tickSize, !long);
    if (long ? stop >= price : stop <= price) return null;
  }

  let target = null;
  if (strategy.target) {
    const distance =
      strategy.target.type === 'rMultiple'
        ? new Decimal(price).minus(stop).abs().times(strategy.target.value)
        : new Decimal(price).abs().times(strategy.target.value).div(100);
    target = roundTick(
      new Decimal(price).plus(distance.times(long ? 1 : -1)),
      contract.tickSize,
      long
    );
    if (long ? target <= price : target >= price) return null;
  }

  return {
    entryPrice: price,
    stop,
    target,
    entryTime: atOpen ? bar.timestamp : bar.endTimestamp,
    entryBarTimestamp: bar.timestamp,
    entryTiming: atOpen ? 'open' : 'intrabar-time-unknown',
    signalTime: signal.endTimestamp,
    session: bar.session,
    tradingDate: bar.tradingDate,
  };
}

export function closePosition(
  position,
  price,
  bar,
  reason,
  strategy,
  policy,
  contract,
  atOpen,
  number
) {
  const gross = new Decimal(price)
    .minus(position.entryPrice)
    .times(strategy.direction === 'long' ? 1 : -1)
    .times(policy.quantity)
    .times(contract.contractMultiplier);

  const commission = new Decimal(policy.commissionPerUnitPerSide)
    .times(policy.quantity)
    .times(2);

  const net = gross.minus(commission);
  const risk =
    position.stop === null
      ? null
      : new Decimal(position.entryPrice)
          .minus(position.stop)
          .abs()
          .times(policy.quantity)
          .times(contract.contractMultiplier);

  const exitTime = atOpen ? bar.timestamp : bar.endTimestamp;

  return {
    ...position,
    _id: `sim-${number}`,
    symbol: bar.symbol,
    strategy: strategy.name,
    setup: strategy.setup,
    direction: strategy.direction,
    quantity: policy.quantity,
    contractMultiplier: contract.contractMultiplier,
    exitTime,
    exitBarTimestamp: bar.timestamp,
    exitTiming: atOpen ? 'open' : 'bar-close-or-intrabar-time-unknown',
    exitPrice: price,
    exitReason: reason,
    grossPnL: gross.toDecimalPlaces(2).toNumber(),
    netPnL: net.toDecimalPlaces(2).toNumber(),
    commissions: commission.toDecimalPlaces(2).toNumber(),
    rMultiple: risk?.gt(0) ? net.div(risk).toDecimalPlaces(3).toNumber() : null,
    holdingTimeSeconds: Math.max(
      0,
      (Date.parse(exitTime) - Date.parse(position.entryTime)) / 1000
    ),
  };
}
