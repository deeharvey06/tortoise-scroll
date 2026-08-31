import JournalEntry from '../models/JournalEntry.js';

export async function listEntries(req, res) {
  const { type, dateFrom, dateTo } = req.query;
  const query = {};
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
  const entry = await JournalEntry.findById(req.params.id).lean();
  if (!entry) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.json(entry);
}

export async function createEntry(req, res) {
  const entry = await JournalEntry.create(req.body);
  res.status(201).json(entry);
}

export async function updateEntry(req, res) {
  const entry = await JournalEntry.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!entry) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.json(entry);
}

export async function deleteEntry(req, res) {
  const deleted = await JournalEntry.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error('Journal entry not found');
  }
  res.status(204).send();
}

export default { listEntries, getEntry, createEntry, updateEntry, deleteEntry };
