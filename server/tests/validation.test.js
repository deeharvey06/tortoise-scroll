import test from 'node:test';
import assert from 'node:assert/strict';

import { loginSchema } from '../src/schemas/auth.schema.js';
import {
  tradeCreateSchema,
  tradeUpdateSchema,
} from '../src/schemas/trade.schema.js';

test('loginSchema rejects empty email/password before business logic', () => {
  const result = loginSchema.safeParse({ email: '', password: '' });

  assert.equal(result.success, false);
});

test('tradeCreateSchema accepts valid trade input and normalizes symbol casing', () => {
  const result = tradeCreateSchema.safeParse({
    accountId: '507f1f77bcf86cd799439011',
    symbol: 'aapl',
    direction: 'long',
    quantity: 100,
    entryPrice: 190,
    exitPrice: 191.5,
    setup: 'Breakout',
    session: 'open',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.symbol, 'AAPL');
});

test('tradeUpdateSchema rejects invalid direction values', () => {
  const result = tradeUpdateSchema.safeParse({ direction: 'sideways' });

  assert.equal(result.success, false);
});
