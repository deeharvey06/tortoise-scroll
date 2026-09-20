import mongoose from 'mongoose';
import { approvedItems } from './knowledgeService.js';
import { fail, parse, preparationInput } from './schema.js';
export function guardKnowledgeFields(input) {
  if (
    ['knowledgeIds', 'knowledgeDraftKey', 'methodology'].some((key) =>
      Object.hasOwn(input, key)
    )
  )
    throw fail(
      400,
      'Use the methodology review endpoint to change knowledge references'
    );
}
export const snapshot = (items) =>
  items.map((i) => ({
    knowledgeId: i._id,
    revision: i.revision,
    name: i.name,
    kind: i.kind,
    dimension: i.dimension,
    interpretation: i.interpretation,
    details: i.details,
    classification: i.classification,
    probability: i.probability,
    references: i.references,
  }));
export async function prepareJournalContext(userId, input) {
  const value = parse(preparationInput, input);
  await approvedItems(userId, value.knowledgeIds);
  for (const scenario of value.scenarios) {
    await approvedItems(userId, scenario.knowledgeIds);
    scenario._id ||= new mongoose.Types.ObjectId().toString();
  }
  const scenarioIds = value.scenarios.map((s) => s._id);
  if (new Set(scenarioIds).size !== scenarioIds.length)
    throw fail(400, 'Scenario IDs must be unique within a plan');
  return value;
}
