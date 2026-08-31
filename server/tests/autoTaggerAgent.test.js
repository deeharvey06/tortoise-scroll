import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition, ruleMatches } from '../src/agents/autoTaggerAgent.js';

const sampleTrade = {
  setup: 'Breakout',
  session: 'open',
  direction: 'long',
  symbol: 'AAPL',
  assetType: 'equity',
  followedPlan: true,
  rMultiple: 2.3,
  netPnL: 150,
  holdingTimeSeconds: 900,
};

test('equals operator is case-insensitive', () => {
  assert.equal(evaluateCondition(sampleTrade, { field: 'setup', operator: 'equals', value: 'breakout' }), true);
  assert.equal(evaluateCondition(sampleTrade, { field: 'setup', operator: 'equals', value: 'Reversal' }), false);
});

test('contains operator does a case-insensitive substring match', () => {
  assert.equal(evaluateCondition(sampleTrade, { field: 'session', operator: 'contains', value: 'PEN' }), true);
  assert.equal(evaluateCondition(sampleTrade, { field: 'session', operator: 'contains', value: 'close' }), false);
});

test('numeric operators compare correctly', () => {
  assert.equal(evaluateCondition(sampleTrade, { field: 'rMultiple', operator: 'gt', value: 2 }), true);
  assert.equal(evaluateCondition(sampleTrade, { field: 'rMultiple', operator: 'gt', value: 3 }), false);
  assert.equal(evaluateCondition(sampleTrade, { field: 'netPnL', operator: 'gte', value: 150 }), true);
  assert.equal(evaluateCondition(sampleTrade, { field: 'netPnL', operator: 'lt', value: 100 }), false);
});

test('null/undefined field values never match', () => {
  const openTrade = { ...sampleTrade, rMultiple: null };
  assert.equal(evaluateCondition(openTrade, { field: 'rMultiple', operator: 'gt', value: 0 }), false);
});

test('ruleMatches requires ALL conditions to pass (AND, not OR)', () => {
  const rule = {
    conditions: [
      { field: 'setup', operator: 'equals', value: 'Breakout' },
      { field: 'rMultiple', operator: 'gte', value: 2 },
    ],
  };
  assert.equal(ruleMatches(sampleTrade, rule), true);

  const failingRule = {
    conditions: [
      { field: 'setup', operator: 'equals', value: 'Breakout' },
      { field: 'rMultiple', operator: 'gte', value: 5 }, // fails
    ],
  };
  assert.equal(ruleMatches(sampleTrade, failingRule), false);
});

test('a rule with no conditions never matches (avoids accidentally tagging everything)', () => {
  assert.equal(ruleMatches(sampleTrade, { conditions: [] }), false);
});
