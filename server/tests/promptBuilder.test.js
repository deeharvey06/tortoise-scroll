import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../src/ai/promptBuilder.js';

test('system prompt embeds the safety rules verbatim', () => {
  const prompt = buildSystemPrompt({ summary: { closedTrades: 0 } }, []);
  assert.match(prompt, /NEVER invent, estimate, or extrapolate/);
  assert.match(prompt, /sample size/i);
  assert.match(prompt, /Never claim causation from correlation/);
  assert.match(prompt, /cannot and must not claim to place trades/);
});

test('system prompt embeds the exact context bundle as JSON, not a paraphrase', () => {
  const bundle = { summary: { netPnL: 273.45, closedTrades: 12 }, bySetup: [{ label: 'Breakout', count: 5 }] };
  const prompt = buildSystemPrompt(bundle, []);
  assert.match(prompt, /"netPnL": 273\.45/);
  assert.match(prompt, /"closedTrades": 12/);
  assert.match(prompt, /"label": "Breakout"/);
});

test('system prompt lists saved memories when present', () => {
  const memories = [
    { category: 'rule', content: 'Never trade the first 5 minutes after open' },
    { category: 'goal', content: 'Keep max daily loss under $200' },
  ];
  const prompt = buildSystemPrompt({ summary: {} }, memories);
  assert.match(prompt, /Never trade the first 5 minutes after open/);
  assert.match(prompt, /Keep max daily loss under \$200/);
});

test('system prompt states explicitly when no memories are saved, rather than an empty section', () => {
  const prompt = buildSystemPrompt({ summary: {} }, []);
  assert.match(prompt, /\(none saved yet\)/);
});
