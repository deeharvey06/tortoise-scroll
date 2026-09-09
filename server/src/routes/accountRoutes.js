import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import Account from '../models/Account.js';
import Trade from '../models/Trade.js';
import { ownedFilter, ownedPayload, withoutOwnership } from '../utils/ownership.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await Account.find(ownedFilter(req)).sort({ createdAt: 1 }).lean();
    res.json(accounts);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne(ownedFilter(req, { _id: req.params.id })).lean();
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.json(account);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const account = await Account.create(ownedPayload(req, req.body));
    res.status(201).json(account);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await Account.findOneAndUpdate(ownedFilter(req, { _id: req.params.id }), withoutOwnership(req.body), {
      new: true,
      runValidators: true,
    });
    if (!account) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.json(account);
  })
);

// Same protection pattern as Strategy/Playbook deletion: refuse to delete
// an account that trades still reference, rather than silently orphaning
// them or cascading a destructive delete the user didn't explicitly ask for.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const inUse = await Trade.countDocuments(ownedFilter(req, { accountId: req.params.id }));
    if (inUse > 0) {
      res.status(409);
      throw new Error(
        `Cannot delete: ${inUse} trade(s) are logged under this account. Delete or reassign them first.`
      );
    }
    const deleted = await Account.findOneAndDelete(ownedFilter(req, { _id: req.params.id }));
    if (!deleted) {
      res.status(404);
      throw new Error('Account not found');
    }
    res.status(204).send();
  })
);

export default router;
