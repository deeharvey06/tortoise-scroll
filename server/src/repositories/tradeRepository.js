import Trade from '../models/Trade.js';

export async function findTrades(query, sort, skip, limit) {
  return Trade.find(query).sort(sort).skip(skip).limit(limit).lean();
}

export async function countTrades(query) {
  return Trade.countDocuments(query);
}

export async function findTradeById(id, userId) {
  return Trade.findOne({ _id: id, userId }).lean();
}

export async function createTrade(payload) {
  const trade = new Trade(payload);
  await trade.save();
  return trade.toObject();
}

export async function updateTradeDocument(id, userId, payload) {
  const trade = await Trade.findOne({ _id: id, userId });
  if (!trade) return null;

  Object.assign(trade, payload);
  await trade.save();
  return trade.toObject();
}

export async function deleteTradeById(id, userId) {
  return Trade.findOneAndDelete({ _id: id, userId });
}

export async function deleteTradesByIds(ids, userId) {
  return Trade.deleteMany({ _id: { $in: ids }, userId });
}

export async function addTagsToTrades(ids, userId, tagsToAdd) {
  return Trade.updateMany(
    { _id: { $in: ids }, userId },
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
