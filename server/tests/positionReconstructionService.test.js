import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconstructPositions,
  positionToTradePayload,
} from '../src/services/positionReconstructionService.js';
import { computeTradeFinancials } from '../src/services/calculationsService.js';

function exec({
  key,
  side,
  qty,
  price,
  time,
  symbol = '/ESU26',
  multiplier = 50,
  effect = 'unknown',
  assetType = 'future',
  commission = 0,
  fees = 0,
}) {
  return {
    broker: 'thinkorswim',
    accountId: 'acct',
    executionKey: key,
    executionId: key,
    instrumentKey: `${symbol}|${assetType}|||`,
    symbol,
    assetType,
    side,
    quantity: qty,
    price,
    timestamp: new Date(time),
    multiplier,
    positionEffect: effect,
    status: 'filled',
    commission,
    fees,
  };
}

test('BUY 2 ES, SELL 1, SELL 1 reconstructs one closed long position', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 2,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
      effect: 'open',
    }),
    exec({
      key: '2',
      side: 'sell',
      qty: 1,
      price: 6001,
      time: '2026-09-01T14:31:00Z',
      effect: 'close',
    }),
    exec({
      key: '3',
      side: 'sell',
      qty: 1,
      price: 6002,
      time: '2026-09-01T14:32:00Z',
      effect: 'close',
    }),
  ]);
  assert.equal(result.positions.length, 1);
  assert.equal(result.positions[0].status, 'closed');
  assert.equal(result.positions[0].openingQuantity, 2);
  assert.equal(result.positions[0].remainingQuantity, 0);
  const financials = computeTradeFinancials(
    positionToTradePayload(result.positions[0], 'acct')
  );
  assert.equal(financials.entryPrice, 6000);
  assert.equal(financials.exitPrice, 6001.5);
  assert.equal(financials.grossPnL, 150); // 1.5 points * 2 contracts * $50
});

test('BUY 1, BUY 1, SELL 1, SELL 2 crosses flat and opens one short contract', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 1,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
      effect: 'open',
    }),
    exec({
      key: '2',
      side: 'buy',
      qty: 1,
      price: 6001,
      time: '2026-09-01T14:31:00Z',
      effect: 'open',
    }),
    exec({
      key: '3',
      side: 'sell',
      qty: 1,
      price: 6002,
      time: '2026-09-01T14:32:00Z',
      effect: 'close',
    }),
    exec({
      key: '4',
      side: 'sell',
      qty: 2,
      price: 6003,
      time: '2026-09-01T14:33:00Z',
    }),
  ]);
  assert.equal(result.positions.length, 2);
  assert.equal(result.positions[0].direction, 'long');
  assert.equal(result.positions[0].status, 'closed');
  assert.equal(result.positions[1].direction, 'short');
  assert.equal(result.positions[1].status, 'open');
  assert.equal(result.positions[1].remainingQuantity, 1);
});

test('partial exit leaves position open and financials unfinalized', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 2,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
      effect: 'open',
    }),
    exec({
      key: '2',
      side: 'sell',
      qty: 1,
      price: 6005,
      time: '2026-09-01T14:31:00Z',
      effect: 'close',
    }),
  ]);
  const position = result.positions[0];
  assert.equal(position.status, 'open');
  assert.equal(position.remainingQuantity, 1);
  const financials = computeTradeFinancials(
    positionToTradePayload(position, 'acct')
  );
  assert.equal(financials.exitPrice, null);
  assert.equal(financials.netPnL, null);
});

test('commission and fees split proportionally across a reversal execution', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 1,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
      commission: 1,
    }),
    exec({
      key: '2',
      side: 'sell',
      qty: 2,
      price: 6001,
      time: '2026-09-01T14:31:00Z',
      commission: 2,
      fees: 1,
    }),
  ]);
  assert.equal(result.positions.length, 2);
  const closeFragment = result.positions[0].executions.at(-1);
  const reverseFragment = result.positions[1].executions[0];
  assert.equal(closeFragment.commission, 1);
  assert.equal(reverseFragment.commission, 1);
  assert.equal(closeFragment.fees, 0.5);
  assert.equal(reverseFragment.fees, 0.5);
});

test('CLOSE execution without an opening execution is unresolved, never guessed', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'sell',
      qty: 1,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
      effect: 'close',
    }),
  ]);
  assert.equal(result.positions.length, 0);
  assert.deepEqual(result.unresolvedExecutions, ['1']);
  assert.match(result.warnings[0], /left unresolved rather than guessing/);
});

test('unsupported reconstruction policy is rejected explicitly', () => {
  assert.throws(
    () => reconstructPositions([], { policy: 'lifo' }),
    /Unsupported reconstruction policy/
  );
});

test('option positions are isolated by expiration/strike/type and apply option multiplier', () => {
  const optionKey = 'AAPL|option|2026-09-18|250|call';
  const rows = [
    {
      ...exec({
        key: 'o1',
        side: 'buy',
        qty: 1,
        price: 2,
        time: '2026-09-01T14:30:00Z',
        symbol: 'AAPL',
        assetType: 'option',
        multiplier: 100,
        effect: 'open',
      }),
      instrumentKey: optionKey,
      expiration: new Date('2026-09-18'),
      strike: 250,
      optionType: 'call',
    },
    {
      ...exec({
        key: 'o2',
        side: 'sell',
        qty: 1,
        price: 3,
        time: '2026-09-01T15:30:00Z',
        symbol: 'AAPL',
        assetType: 'option',
        multiplier: 100,
        effect: 'close',
      }),
      instrumentKey: optionKey,
      expiration: new Date('2026-09-18'),
      strike: 250,
      optionType: 'call',
    },
  ];
  const result = reconstructPositions(rows);
  assert.equal(result.positions.length, 1);
  const trade = positionToTradePayload(result.positions[0], 'acct');
  assert.equal(trade.optionType, 'call');
  assert.equal(trade.strike, 250);
  assert.equal(computeTradeFinancials(trade).grossPnL, 100);
});

test('multiple same-symbol round trips reconstruct as separate trades', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 1,
      price: 6000,
      time: '2026-09-01T14:30:00Z',
    }),
    exec({
      key: '2',
      side: 'sell',
      qty: 1,
      price: 6001,
      time: '2026-09-01T14:31:00Z',
    }),
    exec({
      key: '3',
      side: 'buy',
      qty: 1,
      price: 6002,
      time: '2026-09-01T14:32:00Z',
    }),
    exec({
      key: '4',
      side: 'sell',
      qty: 1,
      price: 6003,
      time: '2026-09-01T14:33:00Z',
    }),
  ]);
  assert.equal(result.positions.length, 2);
  assert.equal(
    result.positions.every((p) => p.status === 'closed'),
    true
  );
  assert.notEqual(
    result.positions[0].sourcePositionKey,
    result.positions[1].sourcePositionKey
  );
});

test('overnight position remains one trade across calendar days', () => {
  const result = reconstructPositions([
    exec({
      key: '1',
      side: 'buy',
      qty: 1,
      price: 6000,
      time: '2026-09-01T23:50:00Z',
    }),
    exec({
      key: '2',
      side: 'sell',
      qty: 1,
      price: 6002,
      time: '2026-09-02T14:30:00Z',
    }),
  ]);
  assert.equal(result.positions.length, 1);
  assert.equal(result.positions[0].status, 'closed');
});
