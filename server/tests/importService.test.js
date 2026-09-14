import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvBuffer,
  previewImport,
} from '../src/services/importService.js';

test('parseCsvBuffer preserves quoted commas, quotes, and multiline values', async () => {
  const csv = Buffer.from(
    'Symbol,Notes\nAAPL,"Breakout, then ""hold""\ninto close"\n'
  );
  const result = await parseCsvBuffer(csv);

  assert.deepEqual(result.headers, ['Symbol', 'Notes']);
  assert.deepEqual(result.rows, [
    { Symbol: 'AAPL', Notes: 'Breakout, then "hold"\ninto close' },
  ]);
});

test('previewImport returns all rows and the selected adapter mapping', async () => {
  const csv = Buffer.from('Symbol,Side,Qty\nAAPL,long,100\n');
  const result = await previewImport(csv, 'tradestation');

  assert.equal(result.totalRows, 1);
  assert.deepEqual(result.headers, ['Symbol', 'Side', 'Qty']);
  assert.equal(result.suggestedMapping.symbol, 'Symbol');
  assert.equal(result.suggestedMapping.direction, 'Side');
});

test('previewImport falls back to generic mapping for an unknown broker', async () => {
  const result = await previewImport(
    Buffer.from('Symbol\nAAPL\n'),
    'unknown-broker'
  );

  assert.deepEqual(result.suggestedMapping, {});
});

test('previewImport detects Thinkorswim execution mode without treating rows as trades', async () => {
  const csv = Buffer.from(
    `Account Statement for TEST\nTrade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Price,Exec ID\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,100,E1\n09/01/2026 09:31:00,SINGLE,SLD,1,TO CLOSE,AAPL,101,E2\n`
  );
  const result = await previewImport(csv, 'thinkorswim');
  assert.equal(result.mode, 'execution');
  assert.equal(result.totalRows, 2);
  assert.equal(result.executionSummary.executionsDetected, 2);
  assert.equal(result.executionSummary.rejectedRows, 0);
  assert.equal(result.suggestedMapping.side, 'Side');
});
