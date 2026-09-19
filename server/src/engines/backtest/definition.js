import { z } from 'zod';

export class BacktestError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
    this.code = 'BACKTEST_INVALID';
  }
}

const period = z.number().int().min(1).max(500);

const condition = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('ema'),
      period,
      comparison: z.enum(['above', 'below']),
    })
    .strict(),
  z
    .object({
      type: z.literal('smaCross'),
      fastPeriod: period,
      slowPeriod: period,
      direction: z.enum(['above', 'below']),
    })
    .strict(),
  z
    .object({
      type: z.literal('insideBar'),
      offset: z.union([z.literal(0), z.literal(1)]),
    })
    .strict(),
  z
    .object({
      type: z.literal('session'),
      value: z.enum(['rth', 'eth', 'premarket', 'postmarket', 'daily']),
    })
    .strict(),
]);

const stop = z.discriminatedUnion('type', [
  z.object({ type: z.literal('signalExtreme') }).strict(),
  z
    .object({
      type: z.literal('distance'),
      value: z.number().positive().finite(),
    })
    .strict(),
  z
    .object({
      type: z.literal('percent'),
      value: z.number().positive().max(100),
    })
    .strict(),
]);

const target = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('rMultiple'),
      value: z.number().positive().max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('percent'),
      value: z.number().positive().finite(),
    })
    .strict(),
]);

export const strategySchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(120),
    setup: z.string().max(120),
    direction: z.enum(['long', 'short']),
    all: z.array(condition).min(1).max(12),
    entry: z
      .object({
        type: z.enum(['market', 'stop', 'limit']),
        reference: z.enum(['high', 'low', 'close']),
        offset: z.number().finite(),
      })
      .strict(),
    stop,
    target,
    exitOnOppositeCross: z.boolean(),
  })
  .strict();

export const executionSchema = z
  .object({
    version: z.literal(1),
    accepted: z.literal(true),
    intrabarPath: z.enum(['open-low-high-close', 'open-high-low-close']),
    sessionBoundary: z.enum(['carry', 'flatten']),
    endOfData: z.enum(['leaveOpen', 'close']),
    pendingAcrossSessions: z.enum(['cancel', 'allow']),
    quantity: z.number().positive().max(1000000),
    slippageTicks: z.number().int().min(0).max(10000),
    commissionPerUnitPerSide: z.number().min(0).finite(),
    fillPolicy: z.literal('full-touch-no-volume-limit'),
    timeInForce: z.literal('nextBar'),
    missingBars: z.literal('reject'),
    futuresRollover: z.literal('single-contract-no-roll'),
  })
  .strict();

export function parseDefinition(strategy, execution) {
  try {
    const result = {
      strategy: strategySchema.parse(strategy),
      execution: executionSchema.parse(execution),
    };
    for (const rule of result.strategy.all)
      if (rule.type === 'smaCross' && rule.fastPeriod >= rule.slowPeriod)
        throw new BacktestError('Fast SMA must be less than slow SMA.');
    return result;
  } catch (error) {
    if (error instanceof BacktestError) throw error;
    throw new BacktestError(
      error.issues
        ?.map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ') || error.message,
      400
    );
  }
}
