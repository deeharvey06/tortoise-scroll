import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTradeQuery } from '../src/services/tradeService.js';

test('buildTradeQuery includes playbook filters', () => {
  const query = buildTradeQuery({
    accountId: 'account-1',
    strategy: 'strategy-1',
    playbook: 'playbook-1',
    symbol: 'aapl',
  });

  assert.deepEqual(query, {
    accountId: 'account-1',
    strategy: 'strategy-1',
    playbook: 'playbook-1',
    symbol: 'AAPL',
  });
});

test('buildTradeQuery escapes search text as a literal case-insensitive regex', () => {
  const query = buildTradeQuery({ search: 'AAPL+breakout' });

  assert.equal(query.$or.length, 4);
  assert.ok(query.$or[0].symbol instanceof RegExp);
  assert.equal(query.$or[0].symbol.source, 'AAPL\\+breakout');
  assert.equal(query.$or[0].symbol.flags, 'i');
});
