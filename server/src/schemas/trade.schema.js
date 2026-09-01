import { z } from 'zod';

const objectIdPattern = /^[a-fA-F0-9]{24}$/;

export const tradeBaseSchema = z.object({
  accountId: z.string().regex(objectIdPattern, 'Invalid accountId'),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((value) => value.toUpperCase()),
  direction: z.enum(['long', 'short']),
  quantity: z.number().positive(),
  entryPrice: z.number().nonnegative(),
  exitPrice: z.number().nonnegative().nullable().optional(),
  setup: z.string().trim().max(80).optional().default(''),
  session: z.string().trim().max(40).optional().default(''),
  tags: z.array(z.string().trim()).optional().default([]),
  notes: z.string().optional().default(''),
  followedPlan: z.boolean().optional(),
});

export const tradeCreateSchema = tradeBaseSchema;

export const tradeUpdateSchema = tradeBaseSchema.partial();

export default { tradeBaseSchema, tradeCreateSchema, tradeUpdateSchema };
