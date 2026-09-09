import JournalEntry from '../models/JournalEntry.js';
import { ownedFilter, ownedPayload, withoutOwnership } from '../utils/ownership.js';
import Account from '../models/Account.js';
import Trade from '../models/Trade.js';

async function validateLinks(req, input) {
  if (input.accountId && !(await Account.exists(ownedFilter(req, { _id: input.accountId })))) { resNotFound(); }
  if (Array.isArray(input.relatedTrades) && await Trade.countDocuments(ownedFilter(req, { _id: { $in: input.relatedTrades } })) !== new Set(input.relatedTrades.map(String)).size) resNotFound();
}
function resNotFound() { const error = new Error('Related resource not found'); error.statusCode = 404; throw error; }

export async function listEntries(req, res) {
  const { type, dateFrom, dateTo } = req.query;
  const query = ownedFilter(req);
  if (type) query.type = type;
  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }
  const entries = await JournalEntry.find(query).sort({ date: -1 }).lean();
  res.json(entries);
}

export async function getEntry(req, res) {
  const entry = await JournalEntry.findOne(ownedFilter(req, { _id: req.params.id })).lean();
  if (!entry) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.json(entry);
}

export async function createEntry(req, res) {
  await validateLinks(req, req.body);
  const entry = await JournalEntry.create(ownedPayload(req, req.body));
  res.status(201).json(entry);
}

export async function updateEntry(req, res) {
  await validateLinks(req, req.body);
  const entry = await JournalEntry.findOneAndUpdate(ownedFilter(req, { _id: req.params.id }), withoutOwnership(req.body), { new: true });
  if (!entry) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.json(entry);
}

export async function deleteEntry(req, res) {
  const deleted = await JournalEntry.findOneAndDelete(ownedFilter(req, { _id: req.params.id }));
  if (!deleted) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.status(204).send();
}

export default { listEntries, getEntry, createEntry, updateEntry, deleteEntry };
