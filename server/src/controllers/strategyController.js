import Strategy from '../models/Strategy.js';
import Trade from '../models/Trade.js';
import { getPerformanceFor } from '../services/performanceService.js';
import { ownedFilter, ownedPayload, withoutOwnership } from '../utils/ownership.js';

export async function listStrategies(req, res) {
  const strategies = await Strategy.find(ownedFilter(req)).sort({ name: 1 }).lean();
  res.json(strategies);
}

export async function getStrategy(req, res) {
  const strategy = await Strategy.findOne(ownedFilter(req, { _id: req.params.id })).lean();
  if (!strategy) {
    res.status(404);
    throw new Error('Strategy not found');
  }
  res.json(strategy);
}

export async function createStrategy(req, res) {
  const strategy = await Strategy.create(ownedPayload(req, req.body));
  res.status(201).json(strategy);
}

export async function updateStrategy(req, res) {
  const strategy = await Strategy.findOneAndUpdate(ownedFilter(req, { _id: req.params.id }), withoutOwnership(req.body), { new: true, runValidators: true });
  if (!strategy) {
    res.status(404);
    throw new Error('Strategy not found');
  }
  res.json(strategy);
}

export async function deleteStrategy(req, res) {
  const inUse = await Trade.countDocuments(ownedFilter(req, { strategy: req.params.id }));
  if (inUse > 0) {
    res.status(409);
    throw new Error(
      `Cannot delete: ${inUse} trade(s) are assigned to this strategy. Reassign or bulk-edit them first.`
    );
  }
  const deleted = await Strategy.findOneAndDelete(ownedFilter(req, { _id: req.params.id }));
  if (!deleted) {
    res.status(404);
    throw new Error('Strategy not found');
  }
  res.status(204).send();
}

export async function getStrategyPerformance(req, res) {
  const strategy = await Strategy.findOne(ownedFilter(req, { _id: req.params.id })).lean();
  if (!strategy) {
    res.status(404);
    throw new Error('Strategy not found');
  }
  const performance = await getPerformanceFor('strategy', req.params.id, req.user.id);
  res.json(performance);
}

export default {
  listStrategies,
  getStrategy,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  getStrategyPerformance,
};
