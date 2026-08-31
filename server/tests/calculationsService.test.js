import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTradeFinancials } from '../src/services/calculationsService.js';

test('long trade: simple win computes correct gross/net P&L and R', () => {
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: 100,
    entryPrice: 10.0,
    exitPrice: 10.5,
    entryTime: '2026-01-01T14:30:00Z',
    exitTime: '2026-01-01T14:45:00Z',
    fees: 1,
    commission: 2,
    riskAmount: 100,
  });

  assert.equal(result.grossPnL, 50); // (10.5 - 10.0) * 100
  assert.equal(result.netPnL, 47); // 50 - 1 - 2
  assert.equal(result.rMultiple, 0.47); // 47 / 100
  assert.equal(result.holdingTimeSeconds, 900);
});

test('short trade: loss computes negative P&L correctly', () => {
  const result = computeTradeFinancials({
    direction: 'short',
    quantity: 50,
    entryPrice: 20.0,
    exitPrice: 20.4,
    entryTime: '2026-01-01T10:00:00Z',
    exitTime: '2026-01-01T10:05:00Z',
    fees: 0,
    commission: 0,
    riskAmount: 40,
  });

  assert.equal(result.grossPnL, -20); // (20 - 20.4) * 50
  assert.equal(result.netPnL, -20);
  assert.equal(result.rMultiple, -0.5); // -20 / 40
});

test('R multiple falls back to stop-loss distance when riskAmount absent', () => {
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: 10,
    entryPrice: 100,
    exitPrice: 106,
    stopLoss: 98,
    entryTime: '2026-01-01T09:30:00Z',
    exitTime: '2026-01-01T09:40:00Z',
    fees: 0,
    commission: 0,
  });

  // risk = (100 - 98) * 10 = 20; netPnL = (106-100)*10 = 60; R = 3
  assert.equal(result.netPnL, 60);
  assert.equal(result.rMultiple, 3);
});

test('short trade derives R from a stop-loss above the entry price', () => {
  const result = computeTradeFinancials({
    direction: 'short',
    quantity: 10,
    entryPrice: 100,
    exitPrice: 94,
    stopLoss: 102,
    entryTime: '2026-01-01T09:30:00Z',
    exitTime: '2026-01-01T09:40:00Z',
  });

  assert.equal(result.netPnL, 60);
  assert.equal(result.rMultiple, 3);
});

test('open trade (no exit) has null P&L and R, not zero', () => {
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: 100,
    entryPrice: 50,
    exitPrice: null,
    entryTime: '2026-01-01T09:30:00Z',
    exitTime: null,
    riskAmount: 100,
  });

  assert.equal(result.grossPnL, null);
  assert.equal(result.netPnL, null);
  assert.equal(result.rMultiple, null);
  assert.equal(result.holdingTimeSeconds, null);
});

test('multi-fill execution aggregates weighted average entry price', () => {
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: null,
    entryPrice: null,
    exitPrice: null,
    entryTime: null,
    exitTime: null,
    riskAmount: 30,
    executions: [
      {
        side: 'buy',
        price: 10,
        quantity: 100,
        time: '2026-01-01T09:30:00Z',
        fees: 0,
        commission: 1,
      },
      {
        side: 'buy',
        price: 11,
        quantity: 100,
        time: '2026-01-01T09:31:00Z',
        fees: 0,
        commission: 1,
      },
      {
        side: 'sell',
        price: 12,
        quantity: 200,
        time: '2026-01-01T09:45:00Z',
        fees: 0,
        commission: 2,
      },
    ],
  });

  // weighted avg entry = (10*100 + 11*100) / 200 = 10.5
  assert.equal(result.entryPrice, 10.5);
  assert.equal(result.exitPrice, 12);
  assert.equal(result.quantity, 200);
  // gross = (12 - 10.5) * 200 = 300; net = 300 - 4 commission
  assert.equal(result.grossPnL, 300);
  assert.equal(result.netPnL, 296);
});

test('entry-only executions remain open and retain entry-side costs', () => {
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: null,
    entryPrice: null,
    exitPrice: null,
    entryTime: null,
    exitTime: null,
    executions: [
      {
        side: 'buy',
        price: 20,
        quantity: 5,
        time: '2026-01-01T09:30:00Z',
        fees: 1,
        commission: 2,
      },
    ],
  });

  assert.equal(result.quantity, 5);
  assert.equal(result.entryPrice, 20);
  assert.equal(result.exitPrice, null);
  assert.equal(result.fees, 1);
  assert.equal(result.commission, 2);
  assert.equal(result.netPnL, null);
});
