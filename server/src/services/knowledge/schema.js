import { z } from 'zod';
export const SOURCE_TYPES = [
  'PRICE_ACTION_FUNDAMENTALS',
  'HOW_TO_TRADE_PRICE_ACTION',
  'PRICE_ACTION_BONUS',
  'PREMARKET_ANALYSIS',
  'STAR_POINTS',
  'PERCENTAGE_PROBABILITY',
  'TRADE_ENTRIES',
  'PERSONAL_NOTES',
];
export const KINDS = [
  'concept',
  'pattern',
  'trade_entry',
  'setup',
  'market_context',
  'rule',
  'guideline',
  'warning',
  'exception',
  'probability',
  'star_point',
  'premarket_principle',
  'management_principle',
  'risk_principle',
];
export const STATUSES = ['needs_review', 'approved', 'rejected', 'superseded'];
export const RELATIONS = [
  'requires',
  'supports',
  'conflicts_with',
  'commonly_occurs_with',
  'invalidates',
  'entry_for',
  'context_for',
  'warning_for',
  'related_to',
  'stronger_when',
  'weaker_when',
];
const text = z.string().max(20000);
export const id = z.string().regex(/^[a-f\d]{24}$/i);
export const ids = z.array(id).max(100);
export const reference = z
  .object({ sourceId: id, sectionId: z.string().min(1).max(100) })
  .strict();
export const itemInput = z
  .object({
    name: z.string().trim().min(1).max(250),
    kind: z.enum(KINDS),
    dimension: z.string().max(80).default(''),
    interpretation: text.default(''),
    classification: z.string().max(100).default(''),
    details: z
      .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/), text)
      .default({}),
    probability: z
      .object({
        statement: text,
        value: z.number().min(0).max(100).nullable().default(null),
        range: z
          .tuple([z.number().min(0).max(100), z.number().min(0).max(100)])
          .nullable()
          .default(null),
        event: text,
        conditions: text,
        context: text.default(''),
        timeframe: text.default(''),
        qualifications: text.default(''),
        exceptions: text.default(''),
      })
      .nullable()
      .default(null),
    references: z.array(reference).min(1).max(30),
    reviewNotes: text.default(''),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.kind === 'probability' && !v.probability)
      c.addIssue({
        code: 'custom',
        message: 'Probability items require contextual probability fields',
      });
    if (v.probability?.range && v.probability.range[0] > v.probability.range[1])
      c.addIssue({ code: 'custom', message: 'Probability range is reversed' });
  });
export const reviewInput = z
  .object({
    revision: z.number().int().positive(),
    status: z.enum(STATUSES),
    verification: z.literal(true).optional(),
    note: text.default(''),
  })
  .strict();
export const relationInput = z
  .object({
    from: id,
    to: id,
    type: z.enum(RELATIONS),
    evidence: text.min(1),
    references: z.array(reference).min(1).max(30),
  })
  .strict();
export const planInput = z
  .object({
    entry: z.number().finite().nullable().default(null),
    stop: z.number().finite().nullable().default(null),
    target: z.number().finite().nullable().default(null),
    exit: z.number().finite().nullable().default(null),
    size: z.number().positive().nullable().default(null),
    risk: z.number().nonnegative().nullable().default(null),
    entryType: id.nullable().default(null),
    strategy: id.nullable().default(null),
    playbook: id.nullable().default(null),
    knowledgeIds: ids.default([]),
    earliestEntry: z.iso.datetime({ offset: true }).nullable().default(null),
    latestEntry: z.iso.datetime({ offset: true }).nullable().default(null),
    maxAdverseEntryDeviation: z.number().nonnegative().nullable().default(null),
    maxEntryFills: z.number().int().positive().nullable().default(null),
    notes: text.default(''),
  })
  .strict()
  .refine(
    (v) =>
      !v.earliestEntry ||
      !v.latestEntry ||
      Date.parse(v.earliestEntry) <= Date.parse(v.latestEntry),
    'Entry time window is reversed'
  );
export const reviewQuestions = [
  'contextCorrect',
  'setupPresent',
  'entryValid',
  'signalAcceptable',
  'entryFollowed',
  'riskFollowed',
  'managementFollowed',
  'scenarioMatched',
];
export const tradeContextInput = z
  .object({
    knowledgeIds: ids.default([]),
    journalId: id.nullable().default(null),
    scenarioId: id.nullable().default(null),
    plan: planInput.nullable().default(null),
    actualEntryType: id.nullable().default(null),
    review: z
      .object(
        Object.fromEntries(
          reviewQuestions.map((k) => [k, z.boolean().nullable().default(null)])
        )
      )
      .strict()
      .default({}),
    notes: text.default(''),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const preparationInput = z
  .object({
    knowledgeIds: ids.default([]),
    priorDay: text.default(''),
    overnight: text.default(''),
    gap: text.default(''),
    openingExpectation: text.default(''),
    riskConsiderations: text.default(''),
    levels: z
      .array(
        z
          .object({
            label: z.string().min(1).max(200),
            price: z.number().finite(),
            timeframe: z.string().max(100).default(''),
          })
          .strict()
      )
      .max(100)
      .default([]),
    scenarios: z
      .array(
        z
          .object({
            _id: id.optional(),
            name: z.string().min(1).max(200),
            condition: text,
            context: text.default(''),
            lookFor: text.default(''),
            avoid: text.default(''),
            invalidatedBy: text.default(''),
            knowledgeIds: ids.default([]),
          })
          .strict()
      )
      .max(30)
      .default([]),
  })
  .strict();
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw fail(400, result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}
export function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}
