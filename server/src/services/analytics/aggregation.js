import Trade from '../../models/Trade.js';
import { buildTradeQuery } from '../tradeService.js';
import {
  DOW,
  group,
  summary,
  sortGroups,
  histogram,
  MONEY_EDGES,
  R_EDGES,
  state,
} from './streaming.js';

export function analyticsMatch(filters) {
  if (!filters?.userId)
    throw new Error('Analytics requires an authenticated owner');
  // Aggregate does not perform Mongoose's find() casting automatically.
  return Trade.find(buildTradeQuery(filters)).cast(Trade);
}
export const CLOSED_MATCH = { netPnL: { $ne: null }, exitTime: { $ne: null } };
const decimal = (field) => ({
  $toDecimal: { $toString: { $ifNull: [field, 0] } },
});
const present = (field) => ({ $ne: [{ $ifNull: [field, null] }, null] });
const cond = (test, yes, no = 0) => ({ $cond: [test, yes, no] });
const win = { $gt: ['$netPnL', 0] },
  loss = { $lt: ['$netPnL', 0] };
function sums() {
  return {
    count: { $sum: 1 },
    wins: { $sum: cond(win, 1) },
    losses: { $sum: cond(loss, 1) },
    net: { $sum: decimal('$netPnL') },
    gross: { $sum: decimal('$grossPnL') },
    winSum: { $sum: cond(win, decimal('$netPnL')) },
    lossSum: { $sum: cond(loss, decimal('$netPnL')) },
    rSum: { $sum: decimal('$rMultiple') },
    rFloat: { $sum: { $ifNull: ['$rMultiple', 0] } },
    rCount: { $sum: cond(present('$rMultiple'), 1) },
    holdSum: { $sum: { $ifNull: ['$holdingTimeSeconds', 0] } },
    holdCount: { $sum: cond(present('$holdingTimeSeconds'), 1) },
    largestWinner: { $max: cond(win, '$netPnL', null) },
    largestLoser: { $min: cond(loss, '$netPnL', null) },
  };
}
function unpack(row) {
  if (!row) return state();
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value?._bsontype === 'Decimal128' ? value.toString() : value,
    ])
  );
}
function distribution(field, edges) {
  return [
    { $match: { ...CLOSED_MATCH, [field]: { $ne: null } } },
    {
      $group: {
        _id: {
          $switch: {
            branches: edges.slice(1, -1).map((edge, index) => ({
              case: { $lt: [`$${field}`, edge] },
              then: index,
            })),
            default: edges.length - 2,
          },
        },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, bucket: '$_id', count: 1 } },
    { $sort: { bucket: 1 } },
  ];
}
export function summaryPipeline(match) {
  return [
    { $match: match },
    {
      $facet: {
        total: [{ $count: 'count' }],
        summary: [
          { $match: CLOSED_MATCH },
          { $group: { _id: null, ...sums() } },
        ],
        money: distribution('netPnL', MONEY_EDGES),
        r: distribution('rMultiple', R_EDGES),
      },
    },
  ];
}
const dimensions = [
  ['bySymbol', '$symbol'],
  ['byStrategy', { $toString: '$strategy' }],
  ['bySetup', '$setup'],
  ['bySession', '$session'],
  ['byDirection', '$direction'],
  [
    'byDayOfWeek',
    { $subtract: [{ $dayOfWeek: { date: '$exitTime', timezone: 'UTC' } }, 1] },
  ],
  ['byHour', { $hour: { date: '$entryTime', timezone: 'UTC' } }],
];
export function groupsPipeline(match) {
  return [
    { $match: { ...match, ...CLOSED_MATCH } },
    {
      $project: {
        netPnL: 1,
        grossPnL: 1,
        rMultiple: 1,
        holdingTimeSeconds: 1,
        dimensions: dimensions.map(([name, key]) => ({ name, key })),
      },
    },
    { $unwind: '$dimensions' },
    { $match: { 'dimensions.key': { $nin: [null, ''] } } },
    { $group: { _id: '$dimensions', ...sums() } },
    { $sort: { '_id.name': 1, net: -1, '_id.key': 1 } },
  ];
}
export function dailyPipeline(match) {
  return [
    { $match: { ...match, ...CLOSED_MATCH } },
    {
      $group: {
        _id: {
          $dateToString: {
            date: '$exitTime',
            format: '%Y-%m-%d',
            timezone: 'UTC',
          },
        },
        ...sums(),
        best: {
          $top: {
            sortBy: { netPnL: -1 },
            output: { symbol: '$symbol', netPnL: '$netPnL' },
          },
        },
        worst: {
          $top: {
            sortBy: { netPnL: 1 },
            output: { symbol: '$symbol', netPnL: '$netPnL' },
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ];
}
async function aggregate(pipeline) {
  const rows = [];
  // A cursor avoids $facet's 16 MB output ceiling for high-cardinality groups.
  for await (const row of Trade.aggregate(pipeline)
    .allowDiskUse(true)
    .cursor({ batchSize: 256 }))
    rows.push(row);
  return rows;
}
export async function aggregateCandidates(
  filters,
  { mode = 'dashboard' } = {}
) {
  const match = analyticsMatch(filters),
    result = {};
  if (mode !== 'calendar') {
    const [raw] = await aggregate(summaryPipeline(match));
    result.summary = summary(unpack(raw.summary[0]), raw.total[0]?.count || 0);
    for (const [name, rows, edges] of [
      ['winLossDistribution', raw.money, MONEY_EDGES],
      ['rMultipleDistribution', raw.r, R_EDGES],
    ]) {
      const counts = [];
      for (const row of rows) counts[row.bucket] = row.count;
      result[name] = histogram(edges, counts);
    }
  }
  if (mode === 'summary') return result;
  if (mode !== 'calendar') {
    for (const [name] of dimensions) result[name] = [];
    for (const row of await aggregate(groupsPipeline(match))) {
      const { name, key } = row._id;
      const label =
        name === 'byDayOfWeek'
          ? DOW[key]
          : name === 'byHour'
            ? `${String(key).padStart(2, '0')}:00 UTC`
            : key;
      result[name].push(group(unpack(row), key, label));
    }
    for (const [name] of dimensions)
      result[name] = sortGroups(name, result[name]);
  }
  result.dailyStats = (await aggregate(dailyPipeline(match))).map((row) => {
    const s = unpack(row),
      g = group(s, row._id);
    return {
      date: row._id,
      netPnL: g.netPnL,
      tradeCount: s.count,
      winRate: g.winRate,
      avgR: s.rCount ? s.rFloat / s.rCount : null,
      bestTrade: s.best,
      worstTrade: s.worst,
    };
  });
  return result;
}
