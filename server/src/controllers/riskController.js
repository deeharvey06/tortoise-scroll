import RiskSettings from '../models/RiskSettings.js';
import { resolveSettings, computeRiskDashboard } from '../services/riskDashboardService.js';
import Account from '../models/Account.js';

export async function getSettings(req, res) {
  const { accountId } = req.query;
  const settings = await resolveSettings(accountId || null, req.user.id);
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
  if (accountId && !(await Account.exists({ _id: accountId, userId: req.user.id }))) { res.status(404); throw new Error('Account not found'); }
  const filter = { userId: req.user.id, accountId: accountId || null };
  const { userId: _ignored, ...safe } = req.body;
  const settings = await RiskSettings.findOneAndUpdate(filter, { ...safe, userId: req.user.id }, {
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
  const result = await computeRiskDashboard(accountId || null, req.user.id);
  res.json(result);
}

export default { getSettings, upsertSettings, getDashboard };
