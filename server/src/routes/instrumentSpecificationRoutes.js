import { Router } from 'express';
import asyncHandler from '../middleware/asyncHandler.js';
import InstrumentSpecification from '../models/InstrumentSpecification.js';
import {
  ownedFilter,
  ownedPayload,
  withoutOwnership,
} from '../utils/ownership.js';
import {
  listBuiltinInstrumentSpecifications,
  resolveInstrumentSpecification,
  futureRoot,
} from '../services/instrumentSpecificationService.js';
const router = Router();
function validatePayload(body = {}) {
  const symbol = String(body.symbol || '')
    .trim()
    .toUpperCase();
  const assetType = String(body.assetType || '')
    .trim()
    .toLowerCase();
  const contractMultiplier = Number(body.contractMultiplier);
  if (!symbol)
    throw Object.assign(new Error('Symbol is required'), { statusCode: 400 });
  if (
    !['equity', 'option', 'future', 'forex', 'crypto', 'other'].includes(
      assetType
    )
  )
    throw Object.assign(new Error('Valid assetType is required'), {
      statusCode: 400,
    });
  if (!(contractMultiplier > 0))
    throw Object.assign(
      new Error('contractMultiplier must be greater than zero'),
      { statusCode: 400 }
    );
  const optionalPositive = (value, label) => {
    if (value === '' || value == null) return null;
    const number = Number(value);
    if (!(number > 0))
      throw Object.assign(new Error(`${label} must be greater than zero`), {
        statusCode: 400,
      });
    return number;
  };
  const timezone = String(body.timezone || 'America/New_York').trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw Object.assign(new Error('timezone must be a valid IANA time zone'), {
      statusCode: 400,
    });
  }
  const currency = String(body.currency || 'USD')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    throw Object.assign(new Error('currency must be a 3-letter code'), {
      statusCode: 400,
    });
  return {
    ...withoutOwnership(body),
    symbol: assetType === 'future' ? futureRoot(symbol) : symbol,
    assetType,
    contractMultiplier,
    tickSize: optionalPositive(body.tickSize, 'tickSize'),
    tickValue: optionalPositive(body.tickValue, 'tickValue'),
    pointValue: optionalPositive(body.pointValue, 'pointValue'),
    currency,
    timezone,
    source: 'user',
  };
}
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const custom = await InstrumentSpecification.find(ownedFilter(req))
      .sort({ symbol: 1 })
      .lean();
    res.json({ builtins: listBuiltinInstrumentSpecifications(), custom });
  })
);
router.get(
  '/resolve',
  asyncHandler(async (req, res) => {
    const spec = await resolveInstrumentSpecification({
      userId: req.user.id,
      symbol: req.query.symbol,
      assetType: String(req.query.assetType || 'future'),
    });
    if (!spec)
      return res
        .status(404)
        .json({ error: { message: 'Instrument specification not found' } });
    res.json(spec);
  })
);
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (
      await InstrumentSpecification.exists(
        ownedFilter(req, {
          symbol: payload.symbol,
          assetType: payload.assetType,
        })
      )
    ) {
      res.status(409);
      throw new Error(
        'A custom specification already exists for this symbol and asset type'
      );
    }
    const doc = await InstrumentSpecification.create(
      ownedPayload(req, payload)
    );
    res.status(201).json(doc);
  })
);
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    const dup = await InstrumentSpecification.exists(
      ownedFilter(req, {
        _id: { $ne: req.params.id },
        symbol: payload.symbol,
        assetType: payload.assetType,
      })
    );
    if (dup) {
      res.status(409);
      throw new Error(
        'A custom specification already exists for this symbol and asset type'
      );
    }
    const doc = await InstrumentSpecification.findOneAndUpdate(
      ownedFilter(req, { _id: req.params.id }),
      payload,
      { new: true, runValidators: true }
    );
    if (!doc) {
      res.status(404);
      throw new Error('Instrument specification not found');
    }
    res.json(doc);
  })
);
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const doc = await InstrumentSpecification.findOneAndDelete(
      ownedFilter(req, { _id: req.params.id })
    );
    if (!doc) {
      res.status(404);
      throw new Error('Instrument specification not found');
    }
    res.status(204).send();
  })
);
export default router;
