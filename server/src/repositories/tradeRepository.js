import Trade from '../models/Trade.js';

export async function findTrades(query, sort, skip, limit) {
  return Trade.find(query).sort(sort).skip(skip).limit(limit).lean();
}

export async function countTrades(query) {
  return Trade.countDocuments(query);
}

export async function findTradeById(id) {
  return Trade.findById(id).lean();
}

export async function createTrade(payload) {
  const trade = new Trade(payload);
  await trade.save();
  return trade.toObject();
}

export async function updateTradeDocument(id, payload) {
  const trade = await Trade.findById(id);
  if (!trade) return null;

  Object.assign(trade, payload);
  await trade.save();
  return trade.toObject();
}

export async function deleteTradeById(id) {
  return Trade.findByIdAndDelete(id);
}

export async function deleteTradesByIds(ids) {
  return Trade.deleteMany({ _id: { $in: ids } });
}

export async function addTagsToTrades(ids, tagsToAdd) {
  return Trade.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { tags: { $each: tagsToAdd } } },
  );
}

export async function exportTradesByQuery(query) {
  return Trade.find(query).sort({ entryTime: -1 }).lean();
}

export default {
  findTrades,
  countTrades,
  findTradeById,
  createTrade,
  updateTradeDocument,
  deleteTradeById,
  deleteTradesByIds,
  addTagsToTrades,
  exportTradesByQuery,
};
