import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvBuffer,
  previewImport,
} from '../src/services/importService.js';

test('parseCsvBuffer preserves quoted commas, quotes, and multiline values', async () => {
  const csv = Buffer.from(
    'Symbol,Notes\nAAPL,"Breakout, then \"hold\"\ninto close"\n',
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
    'unknown-broker',
  );

  assert.deepEqual(result.suggestedMapping, {});
});
