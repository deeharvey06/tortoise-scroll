import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import Account from '../models/Account.js';
import Trade from '../models/Trade.js';
import ImportJob from '../models/ImportJob.js';
import AppSettings from '../models/AppSettings.js';
import BrokerExecution from '../models/BrokerExecution.js';
import BrokerConnection from '../models/BrokerConnection.js';
import JournalEntry from '../models/JournalEntry.js';
import RiskSettings from '../models/RiskSettings.js';
import {
  ownedFilter,
  ownedPayload,
  withoutOwnership,
} from '../utils/ownership.js';
const router = Router();
function clean(input = {}) {
  const safe = withoutOwnership(input);
  const allowed = [
    'name',
    'broker',
    'accountType',
    'currency',
    'startingBalance',
    'tradingConfig',
  ];
  const payload = Object.fromEntries(
    Object.entries(safe).filter(([key]) => allowed.includes(key))
  );
  if (
    payload.startingBalance !== undefined &&
    !Number.isFinite(Number(payload.startingBalance))
  ) {
    throw Object.assign(new Error('startingBalance must be a valid number'), {
      statusCode: 400,
    });
  }
  if (payload.tradingConfig?.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: payload.tradingConfig.timezone,
      }).format(new Date());
    } catch {
      throw Object.assign(
        new Error('tradingConfig.timezone must be a valid IANA time zone'),
        { statusCode: 400 }
      );
    }
  }
  return payload;
}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter =
      req.query.active === 'true'
        ? ownedFilter(req, { isActive: true })
        : ownedFilter(req);
    const [accounts, settings] = await Promise.all([
      Account.find(filter).sort({ isActive: -1, createdAt: 1 }).lean(),
      AppSettings.findOne(ownedFilter(req)).lean(),
    ]);
    res.json(
      accounts.map((a) => ({
        ...a,
        isDefault: String(settings?.defaultAccountId || '') === String(a._id),
      }))
    );
  })
);
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [account, settings] = await Promise.all([
      Account.findOne(ownedFilter(req, { _id: req.params.id })).lean(),
      AppSettings.findOne(ownedFilter(req)).lean(),
    ]);
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.json({
      ...account,
      isDefault:
        String(settings?.defaultAccountId || '') === String(account._id),
    });
  })
);
router.get(
  '/:id/performance',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne(
      ownedFilter(req, { _id: req.params.id })
    ).lean();
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    const rows = await Trade.find(ownedFilter(req, { accountId: account._id }))
      .select('netPnL rMultiple')
      .lean();
    const closed = rows.filter((t) => Number.isFinite(t.netPnL));
    const netPnL = closed.reduce((s, t) => s + Number(t.netPnL || 0), 0);
    const winners = closed.filter((t) => t.netPnL > 0).length;
    const totalR = closed.reduce((s, t) => s + Number(t.rMultiple || 0), 0);
    res.json({
      tradeCount: rows.length,
      closedTradeCount: closed.length,
      netPnL: Number(netPnL.toFixed(2)),
      winRate: closed.length
        ? Number(((winners / closed.length) * 100).toFixed(2))
        : 0,
      totalR: Number(totalR.toFixed(3)),
      currentBalance: Number(
        (Number(account.startingBalance || 0) + netPnL).toFixed(2)
      ),
    });
  })
);
router.get(
  '/:id/import-history',
  asyncHandler(async (req, res) => {
    if (!(await Account.exists(ownedFilter(req, { _id: req.params.id })))) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.json(
      await ImportJob.find(ownedFilter(req, { accountId: req.params.id }))
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    );
  })
);
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = clean(req.body);
    if (!payload.name?.trim()) {
      res.status(400);
      throw new Error('Account name is required');
    }
    const account = await Account.create(ownedPayload(req, payload));
    if (req.body.isDefault && !account.isActive) {
      res.status(409);
      throw new Error('Inactive accounts cannot be the default account');
    }
    if (req.body.isDefault)
      await AppSettings.findOneAndUpdate(
        ownedFilter(req),
        {
          $set: { defaultAccountId: account._id },
          $setOnInsert: { userId: req.user.id },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    res
      .status(201)
      .json({ ...account.toObject(), isDefault: Boolean(req.body.isDefault) });
  })
);
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await Account.findOneAndUpdate(
      ownedFilter(req, { _id: req.params.id }),
      clean(req.body),
      { new: true, runValidators: true }
    );
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    if (req.body.isDefault === true && !account.isActive) {
      res.status(409);
      throw new Error('Inactive accounts cannot be the default account');
    }
    if (req.body.isDefault === true)
      await AppSettings.findOneAndUpdate(
        ownedFilter(req),
        {
          $set: { defaultAccountId: account._id },
          $setOnInsert: { userId: req.user.id },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    else if (req.body.isDefault === false)
      await AppSettings.updateOne(
        ownedFilter(req, { defaultAccountId: account._id }),
        { $set: { defaultAccountId: null } }
      );
    res.json(account);
  })
);
router.post(
  '/:id/default',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne(
      ownedFilter(req, { _id: req.params.id, isActive: true })
    );
    if (!account) {
      res.status(404);
      throw new Error('Active account not found');
    }
    await AppSettings.findOneAndUpdate(
      ownedFilter(req),
      {
        $set: { defaultAccountId: account._id },
        $setOnInsert: { userId: req.user.id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, defaultAccountId: account._id });
  })
);
router.post(
  '/:id/archive',
  asyncHandler(async (req, res) => {
    const account = await Account.findOneAndUpdate(
      ownedFilter(req, { _id: req.params.id }),
      { isActive: false, archivedAt: new Date() },
      { new: true }
    );
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    await AppSettings.updateOne(
      ownedFilter(req, { defaultAccountId: account._id }),
      { $set: { defaultAccountId: null } }
    );
    res.json(account);
  })
);
router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const account = await Account.findOneAndUpdate(
      ownedFilter(req, { _id: req.params.id }),
      { isActive: true, archivedAt: null },
      { new: true }
    );
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.json(account);
  })
);
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne(
      ownedFilter(req, { _id: req.params.id })
    ).lean();
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    const [
      trades,
      imports,
      executions,
      journals,
      riskSettings,
      brokerMappings,
    ] = await Promise.all([
      Trade.countDocuments(ownedFilter(req, { accountId: account._id })),
      ImportJob.countDocuments(ownedFilter(req, { accountId: account._id })),
      BrokerExecution.countDocuments(
        ownedFilter(req, { accountId: account._id })
      ),
      JournalEntry.countDocuments(ownedFilter(req, { accountId: account._id })),
      RiskSettings.countDocuments(ownedFilter(req, { accountId: account._id })),
      BrokerConnection.countDocuments(
        ownedFilter(req, { 'accountMappings.accountId': account._id })
      ),
    ]);
    const references =
      trades + imports + executions + journals + riskSettings + brokerMappings;
    if (references > 0) {
      res.status(409);
      throw new Error(
        `Cannot delete: this account still has ${references} dependent record(s). Archive it instead to preserve historical data.`
      );
    }
    await Account.deleteOne(ownedFilter(req, { _id: account._id }));
    await AppSettings.updateOne(
      ownedFilter(req, { defaultAccountId: account._id }),
      { $set: { defaultAccountId: null } }
    );
    res.status(204).send();
  })
);
export default router;
