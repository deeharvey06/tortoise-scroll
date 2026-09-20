import { z } from 'zod';
import AppSettings from '../models/AppSettings.js';
import Trade from '../models/Trade.js';
import Account from '../models/Account.js';
import Strategy from '../models/Strategy.js';
import Playbook from '../models/Playbook.js';
import JournalEntry from '../models/JournalEntry.js';
import Tag from '../models/Tag.js';
import { ownedFilter, requireOwnedReference } from '../utils/ownership.js';
import { preferencesSchema, parseInput } from '../schemas/workspace.schema.js';

export async function getPreferences(req, res) {
  const doc = await AppSettings.findOne(ownedFilter(req))
    .select('workspace')
    .lean();
  res.json(doc?.workspace || { savedFilters: [] });
}
export async function savePreferences(req, res) {
  const value = parseInput(preferencesSchema, req.body);
  const references = [
    ...(value.savedFilters || []).map((v) => v.filters),
    ...(value.tradeLayout ? [value.tradeLayout.filters] : []),
  ];
  for (const f of references) {
    await requireOwnedReference(Account, f.accountId, req.user.id, 'Account');
    await requireOwnedReference(Strategy, f.strategy, req.user.id, 'Strategy');
  }
  const set = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [`workspace.${k}`, v])
  );
  if (!Object.keys(set).length) return getPreferences(req, res);
  const doc = await AppSettings.findOneAndUpdate(
    ownedFilter(req),
    { $set: set, $setOnInsert: { userId: req.user.id } },
    { upsert: true, new: true, runValidators: true }
  );
  res.json(doc.workspace);
}

export const escapeSearch = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function searchWorkspace(req, res) {
  const q = parseInput(z.string().trim().min(2).max(100), req.query.q);
  const re = new RegExp(escapeSearch(q), 'i');
  const configs = [
    [
      Trade,
      'trade',
      [
        'symbol',
        'notes',
        'entryReason',
        'exitReason',
        'lessonsLearned',
        'setup',
        'tags',
      ],
      'symbol entryTime notes setup tags',
      '/trades/',
    ],
    [
      JournalEntry,
      'scroll',
      ['title', 'content'],
      'title content date',
      '/journal',
    ],
    [
      Strategy,
      'strategy',
      ['name', 'description', 'notes'],
      'name description',
      '/strategies',
    ],
    [
      Playbook,
      'playbook',
      ['setupName', 'description', 'examples'],
      'setupName description',
      '/playbooks',
    ],
    [Tag, 'tag', ['name'], 'name', '/trades'],
  ];
  const groups = await Promise.all(
    configs.map(async ([Model, type, fields, projection, path]) => {
      const docs = await Model.find(
        ownedFilter(req, { $or: fields.map((k) => ({ [k]: re })) })
      )
        .select(projection)
        .sort({ _id: -1 })
        .limit(11)
        .maxTimeMS(2000)
        .lean();
      return {
        type,
        hasMore: docs.length > 10,
        items: docs.slice(0, 10).map((d) => ({
          id: String(d._id),
          type,
          label:
            d.name || d.setupName || d.title || d.symbol || 'Untitled entry',
          excerpt: String(
            d.notes || d.content || d.description || d.setup || ''
          ).slice(0, 240),
          timestamp: d.entryTime || d.date || null,
          href:
            type === 'trade'
              ? path + d._id
              : type === 'tag'
                ? `${path}?tag=${encodeURIComponent(d.name)}`
                : `${path}?focus=${d._id}`,
        })),
      };
    })
  );
  // Symbols come from the owner's trades, not a public/vendor symbol catalogue.
  const symbols = await Trade.aggregate([
    {
      $match: {
        userId: new Trade.base.Types.ObjectId(req.user.id),
        symbol: re,
      },
    },
    { $group: { _id: '$symbol' } },
    { $sort: { _id: 1 } },
    { $limit: 11 },
  ]).option({ maxTimeMS: 2000 });
  groups.push({
    type: 'symbol',
    hasMore: symbols.length > 10,
    items: symbols.slice(0, 10).map((d) => ({
      id: d._id,
      type: 'symbol',
      label: d._id,
      href: `/trades?symbol=${encodeURIComponent(d._id)}`,
    })),
  });
  const tradeTags = await Trade.aggregate([
    {
      $match: { userId: new Trade.base.Types.ObjectId(req.user.id), tags: re },
    },
    { $unwind: '$tags' },
    { $match: { tags: re } },
    { $group: { _id: '$tags' } },
    { $sort: { _id: 1 } },
    { $limit: 11 },
  ]).option({ maxTimeMS: 2000 });
  const tagGroup = groups.find((g) => g.type === 'tag');
  const merged = new Map(tagGroup.items.map((item) => [item.label, item]));
  for (const { _id: name } of tradeTags)
    merged.set(name, {
      id: name,
      type: 'tag',
      label: name,
      href: `/trades?tag=${encodeURIComponent(name)}`,
    });
  tagGroup.hasMore ||= merged.size > 10;
  tagGroup.items = [...merged.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 10);
  res.json({ groups });
}
