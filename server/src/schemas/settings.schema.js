/**
 * Validation schemas for settings and import operations
 */

import { z } from 'zod';

/**
 * Validation for app settings updates
 * Fields are optional since users may update only some settings
 */
export const appSettingsSchema = z.object({
  timezone: z.string().min(1, 'Timezone is required').optional(),
  currency: z.string().min(1, 'Currency is required').optional(),
  defaultAccountId: z.string().optional().nullable(),
  defaultRiskAmount: z
    .number()
    .positive('Default risk amount must be positive')
    .optional()
    .nullable(),
  defaultRMultipleTarget: z
    .number()
    .positive('Default R multiple target must be positive')
    .optional()
    .nullable(),
  defaultStrategyId: z.string().optional().nullable(),
  tradingHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Trading hours must be in HH:MM format')
    .optional(),
  tradingHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Trading hours must be in HH:MM format')
    .optional(),
});

/**
 * Validation for import preview request
 * Preview doesn't require full mapping, just the broker selection
 */
export const importPreviewSchema = z.object({
  broker: z.string().min(1, 'Broker is required'),
});

/**
 * Validation for import commit (actual import of trades)
 * Full mapping is required to process trades
 */
export const importCommitSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  broker: z.string().min(1, 'Broker is required'),
  mapping: z
    .object({
      symbol: z.string().optional(),
      direction: z.string().optional(),
      quantity: z.string().optional(),
      entryPrice: z.string().optional(),
      exitPrice: z.string().optional(),
      entryTime: z.string().optional(),
      exitTime: z.string().optional(),
      fees: z.string().optional(),
      commission: z.string().optional(),
      stopLoss: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

/**
 * Validation for risk settings updates
 */
export const riskSettingsSchema = z.object({
  dailyLossLimit: z
    .number()
    .positive('Daily loss limit must be positive')
    .optional()
    .nullable(),
  weeklyLossLimit: z
    .number()
    .positive('Weekly loss limit must be positive')
    .optional()
    .nullable(),
  maxTradesPerDay: z
    .number()
    .int()
    .positive('Max trades per day must be a positive integer')
    .optional()
    .nullable(),
  maxConsecutiveLosses: z
    .number()
    .int()
    .positive('Max consecutive losses must be a positive integer')
    .optional()
    .nullable(),
  minWinRate: z
    .number()
    .min(0)
    .max(100, 'Min win rate must be between 0 and 100')
    .optional()
    .nullable(),
});

/**
 * Validation for AI settings updates
 */
export const aiSettingsSchema = z.object({
  enableAutoTagger: z.boolean().optional(),
  enablePerformanceAnalysis: z.boolean().optional(),
  enableRiskAlerts: z.boolean().optional(),
  aiProvider: z.enum(['openai', 'claude', 'custom']).optional(),
  model: z.string().min(1, 'Model name is required').optional(),
});
