import { z } from 'zod';
export const id = z.string().regex(/^[a-f\d]{24}$/i);
export const sessions = [
  'pre-market',
  'open',
  'mid-day',
  'power-hour',
  'after-hours',
  'unspecified',
];
export const columns = [
  'entryTime',
  'symbol',
  'direction',
  'quantity',
  'entryPrice',
  'exitPrice',
  'netPnL',
  'rMultiple',
  'setup',
  'session',
  'holdingTimeSeconds',
  'tags',
  'followedPlan',
];
const label = z.string().trim().min(1).max(80);
const strings = z.array(label).max(50);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid calendar date');
export const filtersSchema = z
  .object({
    followedPlan: z.enum(['', 'true', 'false']).default(''),
    outcome: z.enum(['', 'win', 'loss', 'breakeven']).default(''),
    datePreset: z
      .enum([
        'today',
        'yesterday',
        'thisWeek',
        'thisMonth',
        'previousMonth',
        'quarter',
        'year',
        'allTime',
        'custom',
      ])
      .default('allTime'),
    customFrom: calendarDate.nullable().default(null),
    customTo: calendarDate.nullable().default(null),
    accountId: z.union([id, z.literal('')]).default(''),
    strategy: z.union([id, z.literal('')]).default(''),
    symbol: z.string().trim().max(20).default(''),
    setup: z.string().trim().max(80).default(''),
    direction: z.enum(['', 'long', 'short']).default(''),
    session: z.enum(['', ...sessions]).default(''),
    tags: strings.default([]),
  })
  .strict()
  .refine(
    (v) => !v.customFrom || !v.customTo || v.customFrom <= v.customTo,
    'From must precede To'
  );
export const layoutSchema = z
  .object({
    columns: z
      .array(z.enum(columns))
      .min(2)
      .max(columns.length)
      .refine(
        (v) =>
          new Set(v).size === v.length &&
          v.includes('entryTime') &&
          v.includes('symbol'),
        'Date and Symbol are required; columns must be unique'
      ),
    density: z.enum(['compact', 'comfortable']),
    sortBy: z.enum(columns.filter((v) => v !== 'tags')),
    sortDir: z.enum(['asc', 'desc']),
    search: z.string().trim().max(120).default(''),
    filters: filtersSchema,
  })
  .strict();
export const preferencesSchema = z
  .object({
    savedFilters: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: label,
            filters: filtersSchema,
          })
          .strict()
      )
      .max(30)
      .refine(
        (v) => new Set(v.map((x) => x.id)).size === v.length,
        'Duplicate saved filter'
      )
      .optional(),
    tradeLayout: layoutSchema.optional(),
  })
  .strict();
export const bulkEditSchema = z
  .object({
    ids: z.array(id).min(1).max(500),
    changes: z
      .object({
        strategy: id.nullable().optional(),
        playbook: id.nullable().optional(),
        setup: z.string().trim().max(80).optional(),
        session: z.enum(sessions).optional(),
        mistake: strings.optional(),
        followedPlan: z.boolean().nullable().optional(),
        tags: strings.optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0, 'Choose at least one field'),
  })
  .strict();
export function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw Object.assign(
      new Error(result.error.issues.map((v) => v.message).join('; ')),
      { statusCode: 400 }
    );
  return result.data;
}
