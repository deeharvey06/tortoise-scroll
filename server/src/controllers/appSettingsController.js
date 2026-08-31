import AppSettings from '../models/AppSettings.js';

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
    }
  );
}

export async function saveAppSettings(req, res) {
  const existing = await AppSettings.findOne();
  const settings = existing
    ? await AppSettings.findByIdAndUpdate(existing._id, req.body, { new: true, runValidators: true })
    : await AppSettings.create(req.body);
  res.json(settings);
}

export default { getAppSettings, saveAppSettings };
