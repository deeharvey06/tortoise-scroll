import Tag from '../models/Tag.js';
import { ownedFilter } from '../utils/ownership.js';

export async function listTags(req, res) {
  const tags = await Tag.find(ownedFilter(req)).sort({ category: 1, name: 1 }).lean();
  res.json(tags);
}

export async function createTag(req, res) {
  const { category, name, color } = req.body;
  if (!name) {
    res.status(400);
    throw new Error('name is required');
  }
  const tag = await Tag.findOneAndUpdate(
    ownedFilter(req, { category: category || 'Custom', name: name.trim() }),
    { $setOnInsert: { userId: req.user.id, category: category || 'Custom', name: name.trim(), color: color || '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json(tag);
}

export async function deleteTag(req, res) {
  const deleted = await Tag.findOneAndDelete(ownedFilter(req, { _id: req.params.id }));
  if (!deleted) {
    res.status(404);
    throw new Error('Tag not found');
  }
  res.status(204).send();
}

export default { listTags, createTag, deleteTag };
