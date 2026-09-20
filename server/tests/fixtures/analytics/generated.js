import mongoose from 'mongoose';
export const owner = new mongoose.Types.ObjectId('100000000000000000000001');
export const otherOwner = new mongoose.Types.ObjectId(
  '100000000000000000000002'
);
export const accounts = [1, 2].map(
  (n) => new mongoose.Types.ObjectId(`20000000000000000000000${n}`)
);
export const strategies = [1, 2, 3].map(
  (n) => new mongoose.Types.ObjectId(`30000000000000000000000${n}`)
);
export function generatedTrade(i, userId = owner) {
  const entryTime = new Date(
    Date.UTC(2025, 0, 1) +
      (i % 365) * 86400000 +
      (i % 24) * 3600000 +
      (i % 60) * 1000
  );
  const open = i % 19 === 0;
  const netPnL = [
    -500.01, -200, -50, -0.01, 0, 0.01, 49.99, 200, 500.02, 123.45,
  ][i % 10];
  return {
    _id: new mongoose.Types.ObjectId(
      (i + (userId.equals(owner) ? 1 : 10000001)).toString(16).padStart(24, '0')
    ),
    userId,
    accountId: accounts[i % 2],
    strategy: i % 4 ? null : strategies[i % 3],
    symbol: ['ES', 'NQ', 'AAPL', 'MSFT'][i % 4],
    direction: i % 2 ? 'long' : 'short',
    quantity: 1,
    entryPrice: 100,
    exitPrice: open ? null : 101,
    entryTime,
    exitTime: open ? null : new Date(+entryTime + (i % 5) * 3600000),
    netPnL: open ? null : netPnL,
    grossPnL: open ? null : netPnL + 1.25,
    rMultiple:
      open || i % 7 === 0
        ? null
        : [-2.001, -2, -1, 0, 0.1, 0.2, 1, 2, 3, 1.335][i % 10],
    holdingTimeSeconds: open || i % 13 === 0 ? null : (i % 5) * 3600,
    setup: ['Breakout', '', 'Pullback'][i % 3],
    session: ['open', 'mid-day', 'pre-market'][i % 3],
    tags: i % 2 ? ['review'] : [],
    notes: 'Synthetic benchmark record. '.repeat(8),
    executions: [],
  };
}
