import Decimal from 'decimal.js';
const D = (value) => new Decimal(value);
export const roundTick = (price, tick, up) =>
  D(price)
    .div(tick)
    .toDecimalPlaces(0, up ? Decimal.ROUND_CEIL : Decimal.ROUND_FLOOR)
    .times(tick)
    .toNumber();
export function fillPrice(price, side, type, policy, contract, limit = price) {
  const slipped = D(price).plus(
    D(policy.slippageTicks)
      .times(contract.tickSize)
      .times(side === 'buy' ? 1 : -1)
  );
  const value = roundTick(slipped, contract.tickSize, side === 'buy');
  // Limit protection takes priority over slippage; price improvement allowed.
  return type === 'limit'
    ? side === 'buy'
      ? Math.min(value, limit)
      : Math.max(value, limit)
    : value;
}
export function triggerAtOpen(order, open) {
  if (order.type === 'market') return true;
  return order.type === 'stop'
    ? order.side === 'buy'
      ? open >= order.price
      : open <= order.price
    : order.side === 'buy'
      ? open <= order.price
      : open >= order.price;
}
export function segmentTrigger(order, start, end) {
  if (order.type === 'market') return null;
  const risingTrigger =
    (order.type === 'stop' && order.side === 'buy') ||
    (order.type === 'limit' && order.side === 'sell');
  return risingTrigger
    ? end > start && order.price > start && order.price <= end
    : end < start && order.price < start && order.price >= end;
}
export function pathFor(bar, policy) {
  return policy.intrabarPath === 'open-low-high-close'
    ? [bar.open, bar.low, bar.high, bar.close]
    : [bar.open, bar.high, bar.low, bar.close];
}
