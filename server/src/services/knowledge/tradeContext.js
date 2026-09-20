import Trade from '../../models/Trade.js';
import JournalEntry from '../../models/JournalEntry.js';
import Strategy from '../../models/Strategy.js';
import Playbook from '../../models/Playbook.js';
import KnowledgeItem from '../../models/KnowledgeItem.js';
import KnowledgeRelationship from '../../models/KnowledgeRelationship.js';
import { owned, approvedItems } from './knowledgeService.js';
import { snapshot } from './integration.js';
import { evaluateProcess } from './processAnalytics.js';
import { parse, tradeContextInput, fail } from './schema.js';
export async function saveTradeContext(userId, tradeId, input) {
  const value = parse(tradeContextInput, input);
  const trade = await owned(Trade, userId, tradeId);
  const prior = trade.methodology || {};
  if ((prior.revision || 0) !== value.revision)
    throw fail(409, 'Trade context changed; reload before saving');
  value.knowledgeIds = [
    ...new Set([
      ...value.knowledgeIds,
      ...(value.actualEntryType ? [value.actualEntryType] : []),
    ]),
  ];
  const items = await approvedItems(userId, value.knowledgeIds);
  if (value.actualEntryType)
    await requireEntryMechanism(userId, value.actualEntryType);
  let scenario = null;
  if (value.journalId) {
    const journal = await owned(JournalEntry, userId, value.journalId);
    if (journal.type !== 'pre-market')
      throw fail(400, 'Choose a pre-market journal entry');
    if (
      journal.accountId &&
      String(journal.accountId) !== String(trade.accountId)
    )
      throw fail(400, 'Plan belongs to a different trading account');
    const selected = journal.preparation?.scenarios?.find(
      (s) => String(s._id) === value.scenarioId
    );
    if (value.scenarioId && !selected)
      throw fail(400, 'Scenario not found in selected plan');
    scenario = {
      journalId: journal._id,
      scenarioId: value.scenarioId,
      title: journal.title,
      content: journal.content,
      preparation: journal.preparation,
      selected,
      recordedAt: new Date(),
    };
  } else if (value.scenarioId)
    throw fail(400, 'Scenario requires a pre-market plan');
  let planSnapshot = [];
  if (value.plan) {
    planSnapshot = snapshot(
      await approvedItems(userId, value.plan.knowledgeIds)
    );
    if (value.plan.entryType)
      await requireEntryMechanism(userId, value.plan.entryType);
    if (value.plan.strategy) await owned(Strategy, userId, value.plan.strategy);
    if (value.plan.playbook) await owned(Playbook, userId, value.plan.playbook);
  }
  const changedPlan =
    JSON.stringify(prior.plan || null) !== JSON.stringify(value.plan);
  const methodology = {
    ...value,
    revision: value.revision + 1,
    snapshot: snapshot(items),
    scenario,
    planSnapshot,
    recordedAt: new Date(),
    planRecordedAt: changedPlan ? new Date() : prior.planRecordedAt,
    history: [
      ...(prior.history || []),
      ...(prior.revision
        ? [
            {
              at: new Date(),
              revision: prior.revision,
              plan: prior.plan,
              planRecordedAt: prior.planRecordedAt,
              actualEntryType: prior.actualEntryType,
              knowledgeIds: prior.knowledgeIds,
              planSnapshot: prior.planSnapshot,
              notes: prior.notes,
              review: prior.review,
              snapshot: prior.snapshot,
              scenario: prior.scenario,
            },
          ]
        : []),
    ],
  };
  const condition = value.revision
    ? { 'methodology.revision': value.revision }
    : { 'methodology.revision': { $exists: false } };
  const updated = await Trade.findOneAndUpdate(
    { _id: tradeId, userId, ...condition },
    { $set: { methodology } },
    { new: true }
  );
  if (!updated) throw fail(409, 'Trade context changed; reload before saving');
  return { methodology, process: evaluateProcess(updated) };
}
export async function getTradeContext(userId, tradeId) {
  const trade = await owned(Trade, userId, tradeId);
  const ids = (trade.methodology?.snapshot || []).map((s) => s.knowledgeId);
  ids.push(
    ...(trade.methodology?.scenario?.preparation?.knowledgeIds || []),
    ...(trade.methodology?.scenario?.selected?.knowledgeIds || [])
  );
  const targets = [];
  if (trade.strategy)
    targets.push(
      await Strategy.findOne({ _id: trade.strategy, userId }).lean()
    );
  if (trade.playbook)
    targets.push(
      await Playbook.findOne({ _id: trade.playbook, userId }).lean()
    );
  for (const target of targets) ids.push(...(target?.knowledgeIds || []));
  const active = await KnowledgeItem.find({
    userId,
    _id: { $in: ids },
    status: 'approved',
  }).lean();
  const activeIds = active.map((i) => i._id);
  const edges = await KnowledgeRelationship.find({
    userId,
    status: 'approved',
    $or: [{ from: { $in: activeIds } }, { to: { $in: activeIds } }],
  }).lean();
  const related = await KnowledgeItem.find({
    userId,
    status: 'approved',
    _id: { $in: edges.flatMap((e) => [e.from, e.to]) },
  }).lean();
  return {
    methodology: trade.methodology || { revision: 0 },
    process: evaluateProcess(trade),
    knowledge: [
      ...new Map(
        [...active, ...related].map((i) => [String(i._id), i])
      ).values(),
    ],
    strategy: targets.find((t) => t?.name) || null,
    playbook: targets.find((t) => t?.setupName) || null,
  };
}

async function requireEntryMechanism(userId, itemId) {
  const [item] = await approvedItems(userId, [itemId]);
  if (item.dimension !== 'entry_mechanism')
    throw fail(422, 'Choose approved entry-mechanism knowledge');
}
