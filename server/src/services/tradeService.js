import { computeTradeFinancials } from './calculationsService.js';
import * as tradeRepository from '../repositories/tradeRepository.js';

/**
 * Builds the persisted trade payload by merging user input with computed
 * financials. Always call this instead of writing computed fields by hand.
 */
function withComputedFields(input) {
  const computed = computeTradeFinancials(input);
  return { ...input, ...computed };
}

export function buildTradeQuery({
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
}) {
  const query = {};
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
      'i',
    );
    query.$or = [{ symbol: re }, { notes: re }, { setup: re }, { tags: re }];
  }
  return query;
}

export async function listTrades({
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
  sortBy = 'entryTime',
  sortDir = 'desc',
} = {}) {
  const query = buildTradeQuery({
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
  });

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

export async function getTradeById(id) {
  return tradeRepository.findTradeById(id);
}

export async function createTrade(input) {
  const payload = withComputedFields(input);
  return tradeRepository.createTrade(payload);
}

export async function updateTrade(id, input) {
  const existing = await tradeRepository.findTradeById(id);
  if (!existing) return null;

  const merged = { ...existing, ...input };
  const payload = withComputedFields(merged);

  return tradeRepository.updateTradeDocument(id, payload);
}

export async function deleteTrade(id) {
  return tradeRepository.deleteTradeById(id);
}

export async function bulkDeleteTrades(ids) {
  return tradeRepository.deleteTradesByIds(ids);
}

export async function bulkTagTrades(ids, tagsToAdd) {
  return tradeRepository.addTagsToTrades(ids, tagsToAdd);
}

/**
 * Returns ALL trades matching the given filters (no pagination) for CSV
 * export — the export must reflect the full filtered set, not just the
 * currently visible page.
 */
export async function exportTrades(filters = {}) {
  const query = buildTradeQuery(filters);
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
