export const contract = {
  tickSize: 0.01,
  contractMultiplier: 1,
  currency: 'USD',
};

export const strategy = {
  version: 1,
  name: 'Fixture',
  setup: 'RTH',
  direction: 'long',
  all: [{ type: 'session', value: 'rth' }],
  entry: { type: 'market', reference: 'high', offset: 0 },
  stop: { type: 'distance', value: 2 },
  target: { type: 'rMultiple', value: 2 },
  exitOnOppositeCross: false,
};

export const execution = {
  version: 1,
  accepted: true,
  intrabarPath: 'open-low-high-close',
  sessionBoundary: 'carry',
  endOfData: 'leaveOpen',
  pendingAcrossSessions: 'cancel',
  quantity: 1,
  slippageTicks: 0,
  commissionPerUnitPerSide: 0,
  fillPolicy: 'full-touch-no-volume-limit',
  timeInForce: 'nextBar',
  missingBars: 'reject',
  futuresRollover: 'single-contract-no-roll',
};

export function bars(rows) {
  return rows.map(([open, high, low, close], i) => ({
    symbol: 'AAPL',
    timeframe: '1m',
    timestamp: new Date(
      Date.parse('2026-03-09T13:30:00Z') + i * 60000
    ).toISOString(),
    endTimestamp: new Date(
      Date.parse('2026-03-09T13:31:00Z') + i * 60000
    ).toISOString(),
    open,
    high,
    low,
    close,
    volume: 100,
    timezone: 'America/New_York',
    session: 'rth',
    tradingDate: '2026-03-09',
  }));
}
