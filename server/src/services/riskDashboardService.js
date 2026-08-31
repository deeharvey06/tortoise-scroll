import RiskSettings from '../models/RiskSettings.js';
import * as analyticsService from './analyticsService.js';

/** Finds the account-specific settings, falling back to the global (accountId: null) document. */
export async function resolveSettings(accountId) {
  if (accountId) {
    const specific = await RiskSettings.findOne({ accountId }).lean();
    if (specific) return specific;
  }
  const global = await RiskSettings.findOne({ accountId: null }).lean();
  return global || null;
}

export function buildWarnings(settings, current) {
  if (!settings) return [];
  const warnings = [];
  if (settings.maxDailyLoss !== null && settings.maxDailyLoss !== undefined && current.dailyPnL <= -Math.abs(settings.maxDailyLoss)) {
    warnings.push(`Daily loss limit reached: $${Math.abs(current.dailyPnL).toFixed(2)} lost today (limit $${settings.maxDailyLoss}).`);
  } else if (
    settings.maxDailyLoss !== null &&
    settings.maxDailyLoss !== undefined &&
    current.dailyPnL <= -Math.abs(settings.maxDailyLoss) * 0.8
  ) {
    warnings.push(`Approaching your daily loss limit: $${Math.abs(current.dailyPnL).toFixed(2)} of $${settings.maxDailyLoss} used.`);
  }
  if (settings.maxWeeklyLoss !== null && settings.maxWeeklyLoss !== undefined && current.weeklyPnL <= -Math.abs(settings.maxWeeklyLoss)) {
    warnings.push(`Weekly loss limit reached: $${Math.abs(current.weeklyPnL).toFixed(2)} lost this week (limit $${settings.maxWeeklyLoss}).`);
  }
  if (
    settings.maxConsecutiveLosses !== null &&
    settings.maxConsecutiveLosses !== undefined &&
    current.consecutiveLosses >= settings.maxConsecutiveLosses
  ) {
    warnings.push(`You've hit ${current.consecutiveLosses} consecutive losses (limit ${settings.maxConsecutiveLosses}).`);
  }
  if (
    settings.maxTradesPerDay !== null &&
    settings.maxTradesPerDay !== undefined &&
    current.tradesToday >= settings.maxTradesPerDay
  ) {
    warnings.push(`You've placed ${current.tradesToday} trades today (limit ${settings.maxTradesPerDay}).`);
  }
  return warnings;
}

/**
 * Computes the live risk snapshot: today's/week's P&L, drawdown,
 * consecutive losses, exposure — all derived directly from the trade log,
 * never a separately-tracked counter. Shared by the Risk page and the Risk
 * Monitor agent so they can never disagree with each other.
 */
export async function computeRiskDashboard(accountId) {
  const settings = await resolveSettings(accountId || null);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startOfWeek = new Date(now);
  const day = startOfWeek.getUTCDay();
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - day);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const filters = accountId ? { accountId } : {};

  const [allTrades, todayTrades, weekTrades] = await Promise.all([
    analyticsService.getFilteredTrades(filters),
    analyticsService.getFilteredTrades({ ...filters, dateFrom: startOfToday.toISOString() }),
    analyticsService.getFilteredTrades({ ...filters, dateFrom: startOfWeek.toISOString() }),
  ]);

  const closedAll = analyticsService.closedOnly(allTrades);
  const closedToday = analyticsService.closedOnly(todayTrades);
  const closedWeek = analyticsService.closedOnly(weekTrades);

  const dailyPnL = closedToday.reduce((sum, t) => sum + t.netPnL, 0);
  const weeklyPnL = closedWeek.reduce((sum, t) => sum + t.netPnL, 0);

  const equityCurve = analyticsService.buildEquityCurve(closedAll);
  const { maxDrawdown } = analyticsService.buildDrawdownCurve(equityCurve);
  const currentEquity = equityCurve.length ? equityCurve[equityCurve.length - 1].equity : 0;
  const peak = equityCurve.length ? Math.max(...equityCurve.map((p) => p.equity)) : 0;
  const currentDrawdown = equityCurve.length ? currentEquity - peak : 0;

  const streaks = analyticsService.computeStreaks(closedAll);

  const openTrades = allTrades.filter((t) => t.netPnL === null || t.netPnL === undefined);
  const currentExposure = openTrades.reduce((sum, t) => sum + Math.abs(t.quantity * t.entryPrice), 0);

  const current = {
    dailyPnL: Math.round(dailyPnL * 100) / 100,
    weeklyPnL: Math.round(weeklyPnL * 100) / 100,
    tradesToday: todayTrades.length,
    currentDrawdown: Math.round(currentDrawdown * 100) / 100,
    maxDrawdown: closedAll.length ? maxDrawdown : null,
    consecutiveLosses: streaks.currentStreakType === 'loss' ? streaks.currentStreak : 0,
    openPositions: openTrades.length,
    currentExposure: Math.round(currentExposure * 100) / 100,
  };

  return { settings, current, warnings: buildWarnings(settings, current) };
}

export default { resolveSettings, buildWarnings, computeRiskDashboard };
