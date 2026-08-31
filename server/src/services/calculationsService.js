import Decimal from 'decimal.js';

/**
 * All money/ratio math for a trade lives here. Controllers, routes, and the
 * AI layer must call into this module rather than doing arithmetic inline —
 * this is the one place JS float precision issues are guarded against.
 */

function D(value) {
  return new Decimal(value ?? 0);
}

/**
 * If executions exist, derive aggregate quantity/entry/exit price and time
 * from them (weighted average price per side, first entry time, last exit
 * time). Otherwise trust the trade's own top-level fields.
 */
export function deriveAggregatesFromExecutions(trade) {
  const fills = trade.executions || [];
  if (fills.length === 0) {
    return {
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      fees: trade.fees ?? 0,
      commission: trade.commission ?? 0,
    };
  }

  const openingSide = trade.direction === 'long' ? 'buy' : 'sell';
  const closingSide = trade.direction === 'long' ? 'sell' : 'buy';

  const opens = fills.filter((f) => f.side === openingSide);
  const closes = fills.filter((f) => f.side === closingSide);

  const weightedAvg = (fillsForSide) => {
    const totalQty = fillsForSide.reduce((sum, f) => sum.plus(D(f.quantity)), D(0));
    if (totalQty.isZero()) return { price: null, qty: 0 };
    const weighted = fillsForSide.reduce(
      (sum, f) => sum.plus(D(f.price).times(D(f.quantity))),
      D(0)
    );
    return { price: weighted.div(totalQty).toNumber(), qty: totalQty.toNumber() };
  };

  const entryAgg = weightedAvg(opens);
  const exitAgg = weightedAvg(closes);

  const allFees = fills.reduce((sum, f) => sum.plus(D(f.fees)), D(0));
  const allComm = fills.reduce((sum, f) => sum.plus(D(f.commission)), D(0));

  const times = fills.map((f) => new Date(f.time).getTime()).sort((a, b) => a - b);

  return {
    quantity: entryAgg.qty || trade.quantity,
    entryPrice: entryAgg.price ?? trade.entryPrice,
    exitPrice: exitAgg.price,
    entryTime: times.length ? new Date(times[0]) : trade.entryTime,
    exitTime: closes.length ? new Date(times[times.length - 1]) : null,
    fees: allFees.toNumber(),
    commission: allComm.toNumber(),
  };
}

/**
 * Computes gross P&L, net P&L, R multiple, and holding time for a trade
 * object (plain object or Mongoose doc). Returns the fields to persist —
 * it does NOT save the document itself.
 */
export function computeTradeFinancials(tradeInput) {
  const agg = deriveAggregatesFromExecutions(tradeInput);

  const { direction } = tradeInput;
  const qty = D(agg.quantity);
  const entry = D(agg.entryPrice);
  const exit = agg.exitPrice === null || agg.exitPrice === undefined ? null : D(agg.exitPrice);

  let grossPnL = null;
  let netPnL = null;
  let holdingTimeSeconds = null;

  if (exit !== null && qty.gt(0)) {
    const diff = direction === 'long' ? exit.minus(entry) : entry.minus(exit);
    grossPnL = diff.times(qty).toDecimalPlaces(2).toNumber();

    const costs = D(agg.fees).plus(D(agg.commission));
    netPnL = D(grossPnL).minus(costs).toDecimalPlaces(2).toNumber();
  }

  if (agg.entryTime && agg.exitTime) {
    holdingTimeSeconds = Math.max(
      0,
      Math.round((new Date(agg.exitTime).getTime() - new Date(agg.entryTime).getTime()) / 1000)
    );
  }

  // R multiple: netPnL / riskAmount. riskAmount must be a positive dollar
  // figure the user (or stop-loss distance) defines; we never invent one.
  let rMultiple = null;
  const riskAmount = tradeInput.riskAmount;
  if (netPnL !== null && riskAmount !== null && riskAmount !== undefined && Number(riskAmount) > 0) {
    rMultiple = D(netPnL).div(D(riskAmount)).toDecimalPlaces(3).toNumber();
  } else if (
    netPnL !== null &&
    (riskAmount === null || riskAmount === undefined) &&
    tradeInput.stopLoss !== null &&
    tradeInput.stopLoss !== undefined
  ) {
    // Fall back to deriving risk from stop-loss distance × quantity if the
    // user set a stop but never entered a dollar risk figure directly.
    const stopDistance =
      direction === 'long' ? entry.minus(D(tradeInput.stopLoss)) : D(tradeInput.stopLoss).minus(entry);
    const derivedRisk = stopDistance.abs().times(qty);
    if (derivedRisk.gt(0)) {
      rMultiple = D(netPnL).div(derivedRisk).toDecimalPlaces(3).toNumber();
    }
  }

  return {
    quantity: agg.quantity,
    entryPrice: agg.entryPrice,
    exitPrice: agg.exitPrice,
    entryTime: agg.entryTime,
    exitTime: agg.exitTime,
    fees: agg.fees,
    commission: agg.commission,
    grossPnL,
    netPnL,
    rMultiple,
    holdingTimeSeconds,
  };
}

export default { deriveAggregatesFromExecutions, computeTradeFinancials };
