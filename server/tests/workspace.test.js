import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bulkEditSchema,
  preferencesSchema,
  parseInput,
  columns,
} from '../src/schemas/workspace.schema.js';
import { escapeSearch } from '../src/controllers/workspaceController.js';
import { buildTradeQuery } from '../src/services/tradeService.js';
const id = '1234567890abcdef12345678';
test('bulk edits reject financial writes, ownership injection, excessive selection and invalid values', () => {
  for (const input of [
    { ids: [id], changes: { netPnL: 99 } },
    { ids: [id], changes: { userId: id } },
    { ids: [id], changes: {} },
    { ids: Array(501).fill(id), changes: { setup: 'H2' } },
    { ids: [id], changes: { session: 'RTH' } },
    { ids: [id], changes: { tags: [''] } },
    { ids: ['bad'], changes: { setup: 'H2' } },
  ])
    assert.throws(
      () => parseInput(bulkEditSchema, input),
      (e) => e.statusCode === 400
    );
  assert.deepEqual(
    parseInput(bulkEditSchema, {
      ids: [id],
      changes: { strategy: null, followedPlan: false, tags: [], setup: ' H2 ' },
    }).changes,
    { strategy: null, followedPlan: false, tags: [], setup: 'H2' }
  );
});
test('preferences validate bounded columns, sorting, dates and saved filters', () => {
  const valid = {
    tradeLayout: {
      columns,
      density: 'compact',
      sortBy: 'entryTime',
      sortDir: 'desc',
      filters: {},
    },
  };
  assert.equal(
    parseInput(preferencesSchema, valid).tradeLayout.filters.datePreset,
    'allTime'
  );
  for (const patch of [
    { columns: ['symbol'] },
    { columns: ['entryTime', 'symbol', 'symbol'] },
    { sortBy: 'userId' },
    { filters: { customFrom: '2026-02-30' } },
    { filters: { userId: id } },
    { filters: { customFrom: '2026-10-02', customTo: '2026-10-01' } },
  ])
    assert.throws(() =>
      parseInput(preferencesSchema, {
        tradeLayout: { ...valid.tradeLayout, ...patch },
      })
    );
  assert.throws(() =>
    parseInput(preferencesSchema, {
      savedFilters: Array(31).fill({
        id: 'c8904dd5-c858-41d4-868c-78335f8c31c9',
        name: 'ES',
        filters: {},
      }),
    })
  );
});
test('search treats metacharacters literally and plan/loss filters compose with ownership', () => {
  const re = new RegExp(escapeSearch('ES.*[a]'), 'i');
  assert.equal(re.test('ESZZa'), false);
  assert.equal(re.test('ES.*[a]'), true);
  assert.deepEqual(
    buildTradeQuery({
      userId: id,
      followedPlan: 'false',
      outcome: 'loss',
      symbol: 'es',
      setup: 'H2',
    }),
    {
      userId: id,
      followedPlan: false,
      netPnL: { $lt: 0 },
      symbol: 'ES',
      setup: 'H2',
    }
  );
});
