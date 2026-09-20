import Trade from '../models/Trade.js';
import { bulkEditSchema, parseInput } from '../schemas/workspace.schema.js';
import { guardKnowledgeFields } from './knowledge/integration.js';
import { computeTradeFinancials } from './calculationsService.js';
import * as tradeRepository from '../repositories/tradeRepository.js';
import Account from '../models/Account.js';
import Strategy from '../models/Strategy.js';
import Playbook from '../models/Playbook.js';
import { requireOwnedReference } from '../utils/ownership.js';
import { resolveInstrumentSpecification } from './instrumentSpecificationService.js';

/**
 * Builds the persisted trade payload by merging user input with computed
 * financials. Always call this instead of writing computed fields by hand.
 */
function withComputedFields(input) {
  const computed = computeTradeFinancials(input);
  return { ...input, ...computed };
}

export function buildTradeQuery({
  userId,
  accountId,
  symbol,
  strategy,
  playbook,
  setup,
  direction,
  session,
  tags,
  dateFrom,
  dateTo,
  search,
  followedPlan,
  outcome,
}) {
  const query = userId ? { userId } : {};
  if (followedPlan === 'true' || followedPlan === true)
    query.followedPlan = true;
  if (followedPlan === 'false' || followedPlan === false)
    query.followedPlan = false;
  if (outcome === 'win') query.netPnL = { $gt: 0 };
  if (outcome === 'loss') query.netPnL = { $lt: 0 };
  if (outcome === 'breakeven') query.netPnL = 0;
  if (accountId) query.accountId = accountId;
  if (symbol) query.symbol = symbol.toUpperCase();
  if (strategy) query.strategy = strategy;
  if (playbook) query.playbook = playbook;
  if (setup) query.setup = setup;
  if (direction) query.direction = direction;
  if (session) query.session = session;
  if (tags) query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
  if (dateFrom || dateTo) {
    query.entryTime = {};
    if (dateFrom) query.entryTime.$gte = new Date(dateFrom);
    if (dateTo) query.entryTime.$lte = new Date(dateTo);
  }
  if (search) {
    const re = new RegExp(
      search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );
    query.$or = [{ symbol: re }, { notes: re }, { setup: re }, { tags: re }];
  }
  return query;
}

export async function listTrades(
  userId,
  {
    page = 1,
    limit = 50,
    accountId,
    symbol,
    strategy,
    playbook,
    setup,
    direction,
    session,
    tags,
    dateFrom,
    dateTo,
    search,
    followedPlan,
    outcome,
    sortBy = 'entryTime',
    sortDir = 'desc',
  } = {}
) {
  const query = {
    userId,
    ...buildTradeQuery({
      accountId,
      symbol,
      strategy,
      playbook,
      setup,
      direction,
      session,
      tags,
      dateFrom,
      dateTo,
      search,
      followedPlan,
      outcome,
    }),
  };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    tradeRepository.findTrades(query, sort, skip, limitNum),
    tradeRepository.countTrades(query),
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

export async function getTradeById(id, userId) {
  const trade = await tradeRepository.findTradeById(id, userId);
  if (!trade) return null;
  const [account, strategy, playbook] = await Promise.all([
    trade.accountId
      ? Account.findOne({ _id: trade.accountId, userId }).select('name').lean()
      : null,
    trade.strategy
      ? Strategy.findOne({ _id: trade.strategy, userId }).select('name').lean()
      : null,
    trade.playbook
      ? Playbook.findOne({ _id: trade.playbook, userId })
          .select('setupName')
          .lean()
      : null,
  ]);
  return {
    ...trade,
    labels: {
      account: account?.name || null,
      strategy: strategy?.name || null,
      playbook: playbook?.setupName || null,
    },
  };
}

async function assertOwnedRelationships(
  userId,
  input,
  { requireActiveAccount = false } = {}
) {
  if (input.accountId) {
    const accountFilter = { _id: input.accountId, userId };
    if (requireActiveAccount) accountFilter.isActive = true;
    if (!(await Account.exists(accountFilter))) {
      const error = new Error(
        requireActiveAccount ? 'Active account not found' : 'Account not found'
      );
      error.statusCode = 404;
      throw error;
    }
  }
  const checks = [
    [Strategy, input.strategy, 'Strategy'],
    [Playbook, input.playbook, 'Playbook'],
  ];
  for (const [Model, id, label] of checks)
    await requireOwnedReference(Model, id, userId, label);
}

async function withResolvedInstrumentSpecification(input, userId) {
  if (Number(input.multiplier) > 0) return input;
  const assetType = input.assetType || 'equity';
  const spec = await resolveInstrumentSpecification({
    userId,
    symbol: input.symbol,
    assetType,
  });
  if (assetType === 'future' && !spec) {
    const error = new Error(
      `Instrument specification required for futures symbol ${input.symbol}`
    );
    error.statusCode = 422;
    throw error;
  }
  return { ...input, multiplier: spec?.contractMultiplier ?? 1 };
}

export async function createTrade(input, userId) {
  guardKnowledgeFields(input);
  await assertOwnedRelationships(userId, input, { requireActiveAccount: true });
  const { userId: _ignored, ...safeInput } = input;
  const enrichedInput = await withResolvedInstrumentSpecification(
    safeInput,
    userId
  );
  const payload = withComputedFields({ ...enrichedInput, userId });
  return tradeRepository.createTrade(payload);
}

export async function updateTrade(id, input, userId) {
  guardKnowledgeFields(input);
  const existing = await tradeRepository.findTradeById(id, userId);
  if (!existing) return null;
  await assertOwnedRelationships(userId, input);
  const { userId: _ignored, ...safeInput } = input;
  const merged = { ...existing, ...safeInput, userId };
  const enrichedInput = await withResolvedInstrumentSpecification(
    merged,
    userId
  );
  const payload = withComputedFields(enrichedInput);

  return tradeRepository.updateTradeDocument(id, userId, payload);
}

export async function deleteTrade(id, userId) {
  return tradeRepository.deleteTradeById(id, userId);
}

export async function bulkDeleteTrades(ids, userId) {
  return tradeRepository.deleteTradesByIds(ids, userId);
}

export async function bulkTagTrades(ids, tagsToAdd, userId) {
  return tradeRepository.addTagsToTrades(ids, userId, tagsToAdd);
}

/**
 * Returns ALL trades matching the given filters (no pagination) for CSV
 * export — the export must reflect the full filtered set, not just the
 * currently visible page.
 */
export async function exportTrades(filters = {}, userId) {
  const query = { userId, ...buildTradeQuery(filters) };
  return tradeRepository.exportTradesByQuery(query);
}

export default {
  listTrades,
  getTradeById,
  createTrade,
  updateTrade,
  deleteTrade,
  bulkDeleteTrades,
  bulkTagTrades,
  exportTrades,
};

export async function bulkEditTrades(input, userId) {
  const { ids, changes } = parseInput(bulkEditSchema, input);
  const unique = [...new Set(ids)];
  await assertOwnedRelationships(userId, changes);
  if (
    (await Trade.countDocuments({ _id: { $in: unique }, userId })) !==
    unique.length
  )
    throw Object.assign(new Error('One or more trades are unavailable'), {
      statusCode: 404,
    });
  // Classification only: do not recompute or overwrite financial/execution fields.
  return Trade.updateMany(
    { _id: { $in: unique }, userId },
    { $set: changes },
    { runValidators: true }
  );
}
