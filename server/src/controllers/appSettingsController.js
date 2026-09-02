import AppSettings from '../models/AppSettings.js';
import { appSettingsSchema } from '../schemas/settings.schema.js';
import { ownedFilter } from '../utils/ownership.js';
import Account from '../models/Account.js';
import Strategy from '../models/Strategy.js';

export async function getAppSettings(req, res) {
  const settings = await AppSettings.findOne(ownedFilter(req)).lean();
  res.json(
    settings || {
      timezone: 'UTC',
      currency: 'USD',
      defaultAccountId: null,
      defaultRiskAmount: null,
      defaultRMultipleTarget: null,
      defaultStrategyId: null,
      tradingHoursStart: '09:30',
      tradingHoursEnd: '16:00',
    },
  );
}

export async function saveAppSettings(req, res) {
  // Validate request body before persistence
  const validated = appSettingsSchema.parse(req.body);
  if (validated.defaultAccountId && !(await Account.exists(ownedFilter(req, { _id: validated.defaultAccountId })))) { res.status(404); throw new Error('Default account not found'); }
  if (validated.defaultStrategyId && !(await Strategy.exists(ownedFilter(req, { _id: validated.defaultStrategyId })))) { res.status(404); throw new Error('Default strategy not found'); }

  const existing = await AppSettings.findOne(ownedFilter(req));
  const settings = existing
    ? await AppSettings.findOneAndUpdate(ownedFilter(req, { _id: existing._id }), validated, {
        new: true,
        runValidators: true,
      })
    : await AppSettings.create({ ...validated, userId: req.user.id });
  res.json(settings);
}

export default { getAppSettings, saveAppSettings };
