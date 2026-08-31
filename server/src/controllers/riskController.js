import RiskSettings from '../models/RiskSettings.js';
import { resolveSettings, computeRiskDashboard } from '../services/riskDashboardService.js';

export async function getSettings(req, res) {
  const { accountId } = req.query;
  const settings = await resolveSettings(accountId || null);
  res.json(
    settings || {
      accountId: accountId || null,
      maxDailyLoss: null,
      maxWeeklyLoss: null,
      maxPositionSize: null,
      maxTradesPerDay: null,
      maxConsecutiveLosses: null,
      maxRiskPerTrade: null,
    }
  );
}

export async function upsertSettings(req, res) {
  const { accountId } = req.body;
  const filter = { accountId: accountId || null };
  const settings = await RiskSettings.findOneAndUpdate(filter, req.body, {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });
  res.json(settings);
}

/**
 * The live Risk dashboard (spec section 15). Delegates all computation to
 * riskDashboardService so this stays identical to what the Risk Monitor
 * agent (Phase 7) reports — one calculation path, not two.
 */
export async function getDashboard(req, res) {
  const { accountId } = req.query;
  const result = await computeRiskDashboard(accountId || null);
  res.json(result);
}

export default { getSettings, upsertSettings, getDashboard };
