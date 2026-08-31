import Account from '../models/Account.js';
import * as analyticsService from '../services/analyticsService.js';

/**
 * Pulls the shared filter fields off the query string. Kept identical in
 * shape to what tradeService.buildTradeQuery expects, so the same filter
 * bar drives Trades, Dashboard, Calendar, Analytics, and Reports.
 */
function extractFilters(req) {
  const { accountId, symbol, strategy, setup, direction, session, tags, dateFrom, dateTo } = req.query;
  return { accountId, symbol, strategy, setup, direction, session, tags, dateFrom, dateTo };
}

export async function getDashboard(req, res) {
  const filters = extractFilters(req);

  // If filtering to a single account, use its starting balance as the
  // equity curve's baseline; otherwise start from 0 (mixing balances
  // across accounts with different starting capital isn't meaningful).
  let startingBalance = 0;
  if (filters.accountId) {
    const account = await Account.findById(filters.accountId).lean();
    startingBalance = account?.startingBalance || 0;
  }

  const data = await analyticsService.getDashboardAnalytics(filters, startingBalance);
  res.json(data);
}

export async function getCalendar(req, res) {
  const filters = extractFilters(req);
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-indexed
  if (!year || !month) {
    res.status(400);
    throw new Error('year and month query params are required');
  }
  const days = await analyticsService.getCalendarMonth(filters, year, month);
  res.json({ year, month, days });
}

export default { getDashboard, getCalendar };
