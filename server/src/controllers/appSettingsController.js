import AppSettings from '../models/AppSettings.js';
import { appSettingsSchema } from '../schemas/settings.schema.js';

export async function getAppSettings(req, res) {
  const settings = await AppSettings.findOne().lean();
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

  const existing = await AppSettings.findOne();
  const settings = existing
    ? await AppSettings.findByIdAndUpdate(existing._id, validated, {
        new: true,
        runValidators: true,
      })
    : await AppSettings.create(validated);
  res.json(settings);
}

export default { getAppSettings, saveAppSettings };
