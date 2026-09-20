import Decimal from 'decimal.js';
import { buildDrawdownCurve, buildEquityCurve } from '../analyticsService.js';

const D = (value) => new Decimal(value ?? 0);
const rounded = (value, places = 2) =>
  D(value).toDecimalPlaces(places).toNumber();
const ratio = (sum, count, places = 2) =>
  count ? D(sum).div(count).toDecimalPlaces(places).toNumber() : null;
export const DOW = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const GROUPS = [
  'bySymbol',
  'byStrategy',
  'bySetup',
  'bySession',
  'byDirection',
  'byDayOfWeek',
  'byHour',
];
export const MONEY_EDGES = [
  -Infinity,
  -500,
  -200,
  -50,
  0,
  50,
  200,
  500,
  Infinity,
];
export const R_EDGES = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];
export function histogram(edges, counts = []) {
  return edges.slice(0, -1).map((min, i) => ({
    label:
      min === -Infinity
        ? `< ${edges[i + 1]}`
        : edges[i + 1] === Infinity
          ? `≥ ${min}`
          : `${min} to ${edges[i + 1]}`,
    count: counts[i] || 0,
  }));
}
export function state() {
  return {
    count: 0,
    wins: 0,
    losses: 0,
    net: D(0),
    gross: D(0),
    winSum: D(0),
    lossSum: D(0),
    rSum: D(0),
    rFloat: 0,
    rCount: 0,
    holdSum: 0,
    holdCount: 0,
    largestWinner: null,
    largestLoser: null,
  };
}
function groupState() {
  return {
    count: 0,
    wins: 0,
    losses: 0,
    net: D(0),
    winSum: D(0),
    lossSum: D(0),
    rFloat: 0,
    rCount: 0,
  };
}
function addGroup(s, t) {
  s.count++;
  s.net = s.net.plus(D(t.netPnL));
  if (t.netPnL > 0) {
    s.wins++;
    s.winSum = s.winSum.plus(D(t.netPnL));
  }
  if (t.netPnL < 0) {
    s.losses++;
    s.lossSum = s.lossSum.plus(D(t.netPnL));
  }
  if (t.rMultiple != null) {
    s.rFloat += t.rMultiple;
    s.rCount++;
  }
}
function add(s, t) {
  s.count++;
  s.net = s.net.plus(D(t.netPnL));
  s.gross = s.gross.plus(D(t.grossPnL));
  if (t.netPnL > 0) {
    s.wins++;
    s.winSum = s.winSum.plus(D(t.netPnL));
    s.largestWinner = Math.max(s.largestWinner ?? -Infinity, t.netPnL);
  }
  if (t.netPnL < 0) {
    s.losses++;
    s.lossSum = s.lossSum.plus(D(t.netPnL));
    s.largestLoser = Math.min(s.largestLoser ?? Infinity, t.netPnL);
  }
  if (t.rMultiple != null) {
    s.rSum = s.rSum.plus(D(t.rMultiple));
    s.rFloat += t.rMultiple;
    s.rCount++;
  }
  if (t.holdingTimeSeconds != null) {
    s.holdSum += t.holdingTimeSeconds;
    s.holdCount++;
  }
}
export function summary(s, total) {
  return {
    netPnL: s.count ? rounded(s.net) : null,
    grossPnL: s.count ? rounded(s.gross) : null,
    winRate: ratio(D(s.wins).times(100), s.count),
    lossRate: ratio(D(s.losses).times(100), s.count),
    profitFactor:
      s.losses && !D(s.lossSum).isZero()
        ? rounded(D(s.winSum).div(D(s.lossSum).abs()))
        : null,
    avgWin: ratio(s.winSum, s.wins),
    avgLoss: ratio(s.lossSum, s.losses),
    expectancy: ratio(s.net, s.count),
    avgR: ratio(s.rSum, s.rCount, 3),
    totalTrades: total,
    closedTrades: s.count,
    openTrades: total - s.count,
    winningTrades: s.wins,
    losingTrades: s.losses,
    largestWinner: s.largestWinner,
    largestLoser: s.largestLoser,
    avgHoldingTimeSeconds: s.holdCount
      ? Math.round(s.holdSum / s.holdCount)
      : null,
  };
}
export function group(s, key, label = key) {
  return {
    key,
    label,
    count: s.count,
    netPnL: rounded(s.net),
    winRate: ratio(D(s.wins).times(100), s.count, 0),
    avgR: ratio(s.rFloat, s.rCount),
    profitFactor:
      s.losses && !D(s.lossSum).isZero()
        ? rounded(D(s.winSum).div(D(s.lossSum).abs()))
        : null,
  };
}
function label(name, key) {
  return name === 'byStrategy'
    ? String(key)
    : name === 'byDayOfWeek'
      ? DOW[key]
      : name === 'byHour'
        ? `${String(key).padStart(2, '0')}:00 UTC`
        : key;
}
export function sortGroups(name, rows) {
  const sorted = rows.sort(
    name === 'byDayOfWeek' || name === 'byHour'
      ? (a, b) => a.key - b.key
      : (a, b) => b.netPnL - a.netPnL
  );
  return name === 'bySymbol' ? sorted.slice(0, 25) : sorted;
}

/** Exact compatibility reducer: cursor order is the original find() order.
 * Memory is groups + days + the narrow equity sequence, never full Trade documents.
 * Persisted ObjectId strategy keys deliberately retain legacy object identity.
 */
export async function streamAnalytics(
  cursor,
  startingBalance = 0,
  { mode = 'dashboard' } = {}
) {
  let total = 0;
  const overall = state(),
    days = new Map(),
    maps = Object.fromEntries(GROUPS.map((name) => [name, new Map()]));
  const equityInput = [],
    money = Array(8).fill(0),
    r = Array(7).fill(0);
  const bucket = (v, edges, counts) => {
    const i = edges.findIndex(
      (edge, idx) => idx < edges.length - 1 && v >= edge && v < edges[idx + 1]
    );
    counts[i < 0 ? counts.length - 1 : i]++;
  };
  for await (const t of cursor) {
    total++;
    if (t.netPnL == null || !t.exitTime) continue;
    if (mode !== 'calendar') {
      add(overall, t);
      if (mode !== 'market') {
        equityInput.push(
          mode === 'summary'
            ? { exitTime: t.exitTime, netPnL: t.netPnL }
            : {
                _id: t._id,
                symbol: t.symbol,
                exitTime: t.exitTime,
                netPnL: t.netPnL,
              }
        );
        bucket(t.netPnL, MONEY_EDGES, money);
        if (t.rMultiple != null) bucket(t.rMultiple, R_EDGES, r);
      }
    }
    if (mode === 'summary') continue;
    if (mode !== 'market') {
      const day = new Date(t.exitTime).toISOString().slice(0, 10);
      if (!days.has(day))
        days.set(day, { ...groupState(), best: null, worst: null });
      const d = days.get(day);
      addGroup(d, t);
      if (!d.best || t.netPnL > d.best.netPnL)
        d.best = { symbol: t.symbol, netPnL: t.netPnL };
      if (!d.worst || t.netPnL < d.worst.netPnL)
        d.worst = { symbol: t.symbol, netPnL: t.netPnL };
    }
    if (mode === 'calendar') continue;
    const keys = [
      t.symbol,
      t.strategy,
      t.setup,
      t.session,
      t.direction,
      new Date(t.exitTime).getUTCDay(),
      new Date(t.entryTime).getUTCHours(),
    ];
    GROUPS.forEach((name, i) => {
      const key = keys[i];
      if (key == null || key === '') return;
      if (!maps[name].has(key)) maps[name].set(key, groupState());
      addGroup(maps[name].get(key), t);
    });
  }
  const dailyStats = [...days]
    .map(([date, d]) => ({
      date,
      netPnL: rounded(d.net),
      tradeCount: d.count,
      winRate: ratio(D(d.wins).times(100), d.count, 0),
      avgR: d.rCount ? d.rFloat / d.rCount : null,
      bestTrade: d.best,
      worstTrade: d.worst,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (mode === 'calendar') return dailyStats;
  const breakdowns = () =>
    Object.fromEntries(
      GROUPS.map((name) => [
        name,
        sortGroups(
          name,
          [...maps[name]].map(([key, s]) => group(s, key, label(name, key)))
        ),
      ])
    );
  if (mode === 'market') return { sampleSize: overall.count, ...breakdowns() };

  if (mode === 'summary') {
    // Same stable exit-time ordering and first-point peak as the legacy curve,
    // without allocating equity and drawdown objects that this DTO omits.
    equityInput.sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
    let running = D(startingBalance),
      peak = null,
      maxDrawdown = 0;
    for (const trade of equityInput) {
      running = running.plus(D(trade.netPnL));
      const equity = rounded(running);
      peak = peak === null ? equity : Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, rounded(D(equity).minus(D(peak))));
    }
    return {
      summary: {
        ...summary(overall, total),
        maxDrawdown: overall.count ? maxDrawdown : null,
      },
      winLossDistribution: histogram(MONEY_EDGES, money),
      rMultipleDistribution: histogram(R_EDGES, r),
    };
  }
  const grouped = breakdowns();
  for (const map of Object.values(maps)) map.clear();
  const equityCurve = buildEquityCurve(equityInput, startingBalance);
  equityInput.length = 0;
  const { curve: drawdownCurve, maxDrawdown } = buildDrawdownCurve(equityCurve);
  const result = {
    summary: {
      ...summary(overall, total),
      maxDrawdown: overall.count ? maxDrawdown : null,
    },
    winLossDistribution: histogram(MONEY_EDGES, money),
    rMultipleDistribution: histogram(R_EDGES, r),
  };
  return {
    ...result,
    equityCurve,
    drawdownCurve,
    dailyStats,
    ...grouped,
  };
}
