import KnowledgeSource from '../../models/KnowledgeSource.js';
import KnowledgeItem from '../../models/KnowledgeItem.js';
import KnowledgeRelationship from '../../models/KnowledgeRelationship.js';
import Strategy from '../../models/Strategy.js';
import Playbook from '../../models/Playbook.js';
import JournalEntry from '../../models/JournalEntry.js';
import { fail } from './schema.js';
export const KNOWLEDGE_COLLECTIONS = [
  ['knowledgeSources', KnowledgeSource],
  ['knowledgeItems', KnowledgeItem],
  ['knowledgeRelationships', KnowledgeRelationship],
];
export async function validateKnowledgeBackup(data, userId) {
  const present =
    KNOWLEDGE_COLLECTIONS.some(([k]) => Array.isArray(data[k])) ||
    ['trades', 'strategies', 'playbooks', 'journalEntries'].some((k) =>
      (data[k] || []).some(
        (d) => d.methodology || d.knowledgeIds?.length || d.preparation
      )
    );
  if (!present) return;
  const models = [
    ...KNOWLEDGE_COLLECTIONS,
    ['strategies', Strategy],
    ['playbooks', Playbook],
    ['journalEntries', JournalEntry],
  ];
  const allowed = {};
  for (const [key, Model] of models) {
    const docs = Array.isArray(data[key])
      ? data[key]
      : await Model.find({ userId }).select('_id').lean();
    allowed[key] = new Set(docs.map((d) => String(d._id)));
    if (
      Array.isArray(data[key]) &&
      docs.length &&
      (await Model.exists({
        _id: { $in: docs.map((d) => d._id) },
        userId: { $ne: userId },
      }))
    )
      throw fail(400, 'Backup contains an ID belonging to another user');
  }
  const check = (key, value) => {
    if (value != null && !allowed[key].has(String(value)))
      throw fail(400, `Invalid backup methodology relationship: ${key}`);
  };
  const refs = (values) => {
    for (const ref of values || []) check('knowledgeSources', ref.sourceId);
  };
  const knowledge = (values) => {
    for (const value of values || []) check('knowledgeItems', value);
  };
  for (const item of data.knowledgeItems || []) refs(item.references);
  for (const edge of data.knowledgeRelationships || []) {
    knowledge([edge.from, edge.to]);
    refs(edge.references);
  }
  for (const key of ['strategies', 'playbooks'])
    for (const target of data[key] || []) knowledge(target.knowledgeIds);
  for (const entry of data.journalEntries || []) {
    knowledge(entry.preparation?.knowledgeIds);
    for (const s of entry.preparation?.scenarios || [])
      knowledge(s.knowledgeIds);
  }
  for (const trade of data.trades || []) {
    const context = trade.methodology;
    if (!context) continue;
    for (const version of [context, ...(context.history || [])]) {
      knowledge(version.knowledgeIds);
      knowledge((version.snapshot || []).map((s) => s.knowledgeId));
      for (const s of version.snapshot || []) refs(s.references);
      check('journalEntries', version.journalId);
      check('journalEntries', version.scenario?.journalId);
      knowledge((version.planSnapshot || []).map((s) => s.knowledgeId));
      for (const s of version.planSnapshot || []) refs(s.references);
      knowledge(version.scenario?.preparation?.knowledgeIds);
      for (const s of version.scenario?.preparation?.scenarios || [])
        knowledge(s.knowledgeIds);
      knowledge(version.scenario?.selected?.knowledgeIds);
      knowledge(version.plan?.knowledgeIds);
      check('knowledgeItems', version.plan?.entryType);
      check('knowledgeItems', version.actualEntryType);
      check('strategies', version.plan?.strategy);
      check('playbooks', version.plan?.playbook);
    }
  }
}
export function restoredKnowledge(key, doc) {
  if (!['knowledgeItems', 'knowledgeRelationships'].includes(key)) return doc;
  // Restore is not an approval operation. Explicit source review is required again.
  return {
    ...doc,
    status: 'needs_review',
    verifiedAt: null,
    revision: (doc.revision || 0) + 1,
    history: [
      ...(doc.history || []),
      {
        at: new Date(),
        action: 'restored_needs_review',
        revision: doc.revision || 0,
      },
    ],
  };
}
