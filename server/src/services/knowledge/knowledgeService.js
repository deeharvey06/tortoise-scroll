import KnowledgeSource from '../../models/KnowledgeSource.js';
import KnowledgeItem from '../../models/KnowledgeItem.js';
import KnowledgeRelationship from '../../models/KnowledgeRelationship.js';
import Strategy from '../../models/Strategy.js';
import Playbook from '../../models/Playbook.js';
import {
  fail,
  parse,
  id,
  ids,
  itemInput,
  relationInput,
  reviewInput,
} from './schema.js';

export async function owned(Model, userId, recordId) {
  parse(id, String(recordId));
  const record = await Model.findOne({ _id: recordId, userId });
  if (!record) throw fail(404, 'Resource not found');
  return record;
}
export async function approvedItems(userId, values) {
  const keys = [...new Set(parse(ids, values || []))];
  if (!keys.length) return [];
  const items = await KnowledgeItem.find({
    userId,
    _id: { $in: keys },
    status: 'approved',
  }).lean();
  if (items.length !== keys.length)
    throw fail(
      422,
      'Every knowledge reference must belong to you and be approved'
    );
  return keys.map((key) => items.find((item) => String(item._id) === key));
}
export async function resolveReferences(userId, references) {
  const result = [];
  for (const reference of references) {
    const source = await owned(KnowledgeSource, userId, reference.sourceId);
    const section = source.sections.find((s) => s.id === reference.sectionId);
    if (!section) throw fail(400, 'Source section not found');
    result.push({
      ...reference,
      page: section.page,
      heading: section.heading,
      text: section.text,
      location: source.location,
      sourceType: source.sourceType,
    });
  }
  return result;
}
export async function createItem(userId, input) {
  const value = parse(itemInput, input);
  return KnowledgeItem.create({
    ...value,
    userId,
    references: await resolveReferences(userId, value.references),
    status: 'needs_review',
  });
}
export async function editItem(userId, recordId, input) {
  const { revision, ...rest } = input;
  const value = parse(itemInput, rest);
  const previous = await owned(KnowledgeItem, userId, recordId);
  if (previous.revision !== revision)
    throw fail(409, 'Knowledge changed; reload before editing');
  const updated = await KnowledgeItem.findOneAndUpdate(
    { _id: recordId, userId, revision },
    {
      $set: {
        ...value,
        references: await resolveReferences(userId, value.references),
        status: 'needs_review',
        verifiedAt: null,
      },
      $inc: { revision: 1 },
      $push: {
        history: {
          at: new Date(),
          action: 'edit',
          revision,
          previous: {
            name: previous.name,
            kind: previous.kind,
            dimension: previous.dimension,
            interpretation: previous.interpretation,
            details: previous.details,
            probability: previous.probability,
            references: previous.references,
            status: previous.status,
          },
        },
      },
    },
    { new: true, runValidators: true }
  );
  if (!updated) throw fail(409, 'Knowledge changed; reload before editing');
  return updated;
}
export async function reviewRecord(Model, userId, recordId, input) {
  const value = parse(reviewInput, input);
  const record = await owned(Model, userId, recordId);
  if (record.revision !== value.revision)
    throw fail(409, 'Record changed; reload before reviewing');
  if (value.status === 'approved') {
    if (!value.verification)
      throw fail(400, 'Explicit source verification is required');
    if (Model === KnowledgeItem && !record.interpretation?.trim())
      throw fail(422, 'Provide a reviewed interpretation before approving');
    if (Model === KnowledgeItem && record.kind === 'probability') {
      if (
        !record.probability?.statement?.trim() ||
        !record.probability?.event?.trim() ||
        !record.probability?.conditions?.trim()
      )
        throw fail(
          422,
          'Retain the probability statement, event and conditions'
        );
    }
    if (Model === KnowledgeRelationship)
      await approvedItems(userId, [String(record.from), String(record.to)]);
    await resolveReferences(userId, record.references);
  }
  const updated = await Model.findOneAndUpdate(
    { _id: recordId, userId, revision: value.revision },
    {
      $set: {
        status: value.status,
        verifiedAt: value.status === 'approved' ? new Date() : null,
      },
      $inc: { revision: 1 },
      $push: {
        history: {
          at: new Date(),
          action: value.status,
          note: value.note,
          revision: value.revision,
          previous: { status: record.status },
        },
      },
    },
    { new: true }
  );
  if (!updated) throw fail(409, 'Record changed; reload before reviewing');
  return updated;
}
export async function createRelation(userId, input) {
  const value = parse(relationInput, input);
  if (value.from === value.to)
    throw fail(400, 'A relationship needs two different items');
  await owned(KnowledgeItem, userId, value.from);
  await owned(KnowledgeItem, userId, value.to);
  const existing = await KnowledgeRelationship.findOne({
    userId,
    from: value.from,
    to: value.to,
    type: value.type,
  });
  if (existing) return existing;
  return KnowledgeRelationship.create({
    ...value,
    userId,
    references: await resolveReferences(userId, value.references),
  });
}
export async function attachKnowledge(userId, type, targetId, knowledgeIds) {
  const Model =
    type === 'strategy' ? Strategy : type === 'playbook' ? Playbook : null;
  if (!Model) throw fail(400, 'Choose strategy or playbook');
  const items = await approvedItems(userId, knowledgeIds);
  if (!items.length) throw fail(400, 'Select approved knowledge');
  let target;
  if (targetId) target = await owned(Model, userId, targetId);
  else {
    // The owner/key unique index also handles concurrent repeated draft requests.
    const key = items
      .map((i) => String(i._id))
      .sort()
      .join(':');
    target = await Model.findOneAndUpdate(
      { userId, knowledgeDraftKey: key },
      {
        $setOnInsert: {
          userId,
          [type === 'strategy' ? 'name' : 'setupName']: items[0].name,
          description:
            'Methodology draft — review and complete the trading plan before use.',
          isActive: false,
          knowledgeDraftKey: key,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
  return Model.findOneAndUpdate(
    { _id: target._id, userId },
    { $addToSet: { knowledgeIds: { $each: items.map((i) => i._id) } } },
    { new: true }
  );
}
export async function referencesForTarget(userId, type, targetId) {
  const Model = type === 'strategy' ? Strategy : Playbook;
  const target = await owned(Model, userId, targetId);
  const attached = await KnowledgeItem.find({
    userId,
    _id: { $in: target.knowledgeIds || [] },
  }).lean();
  return {
    items: attached.filter((i) => i.status === 'approved'),
    inactive: attached
      .filter((i) => i.status !== 'approved')
      .map((i) => ({ _id: i._id, name: i.name, status: i.status })),
  };
}

export async function editRelation(userId, recordId, input) {
  const { revision, ...rest } = input;
  const value = parse(relationInput, rest);
  const previous = await owned(KnowledgeRelationship, userId, recordId);
  if (previous.revision !== revision)
    throw fail(409, 'Relationship changed; reload before editing');
  if (value.from === value.to)
    throw fail(400, 'A relationship needs two different items');
  await owned(KnowledgeItem, userId, value.from);
  await owned(KnowledgeItem, userId, value.to);
  const updated = await KnowledgeRelationship.findOneAndUpdate(
    { _id: recordId, userId, revision },
    {
      $set: {
        ...value,
        references: await resolveReferences(userId, value.references),
        status: 'needs_review',
        verifiedAt: null,
      },
      $inc: { revision: 1 },
      $push: {
        history: {
          at: new Date(),
          action: 'edit',
          revision,
          previous: {
            from: previous.from,
            to: previous.to,
            type: previous.type,
            evidence: previous.evidence,
            references: previous.references,
            status: previous.status,
          },
        },
      },
    },
    { new: true }
  );
  if (!updated) throw fail(409, 'Relationship changed; reload before editing');
  return updated;
}
