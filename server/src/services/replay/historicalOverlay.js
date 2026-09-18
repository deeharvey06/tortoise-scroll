import Decimal from 'decimal.js';

// Only time-stamped executions can become as-of overlays. Aggregate P&L, final
// weighted entry price, notes, strategy/setup and risk levels are never copied
// into this projection. They may have been edited after the historical moment.
export function historicalMarkers(trades, timestamp, from) {
  const markers = [];
  for (const trade of trades) {
    const fills = trade.executions?.length
      ? trade.executions
      : [
          {
            time: trade.entryTime,
            side: trade.direction === 'long' ? 'buy' : 'sell',
            price: trade.entryPrice,
            quantity: trade.quantity,
          },
          ...(trade.exitTime && trade.exitPrice !== null
            ? [
                {
                  time: trade.exitTime,
                  side: trade.direction === 'long' ? 'sell' : 'buy',
                  price: trade.exitPrice,
                  quantity: trade.quantity,
                },
              ]
            : []),
        ];

    let position = new Decimal(0);
    const entrySide = trade.direction === 'long' ? 'buy' : 'sell';
    for (const fill of fills
      .filter((item) => new Date(item.time).toISOString() <= timestamp)
      .sort((a, b) => new Date(a.time) - new Date(b.time))) {
      const time = new Date(fill.time).toISOString();
      let kind;

      if (fill.side === entrySide) {
        kind = position.isZero() ? 'entry' : 'scale-in';
        position = position.plus(fill.quantity);
      } else {
        const remaining = position.minus(fill.quantity);
        kind = remaining.isZero()
          ? 'exit'
          : remaining.gt(0)
            ? 'scale-out'
            : 'execution';
        position = Decimal.max(0, remaining);
      }

      if (time >= from)
        markers.push({
          tradeId: String(trade.id),
          timestamp: time,
          price: fill.price,
          quantity: fill.quantity,
          side: fill.side,
          kind,
        });
    }
  }

  return markers.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function historicalComparison(trades, timestamp) {
  return trades
    .filter((trade) => new Date(trade.entryTime).toISOString() <= timestamp)
    .map((trade) => ({
      id: trade.id,
      direction: trade.direction,
      setup: trade.setup,
      strategy: trade.strategy,
      notes: trade.notes,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      // Unclosed trades must not reveal a later result even at this run's end.
      netPnL:
        trade.exitTime && new Date(trade.exitTime).toISOString() <= timestamp
          ? trade.netPnL
          : null,
      resultAvailable: Boolean(
        trade.exitTime && new Date(trade.exitTime).toISOString() <= timestamp
      ),
    }));
}
