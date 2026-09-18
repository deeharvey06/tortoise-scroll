import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThinkorswimExecutions,
  extractThinkorswimTradeSection,
} from '../src/utils/thinkorswimParser.js';

const TOS = Buffer.from(
  `Account Statement for TEST\nAccount Summary\n\nTrade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Order ID,Exec ID,Commission,Misc Fees\n09/01/2026 09:30:00,SINGLE,BOT,2,TO OPEN,/ESU26,,,,6000,O1,E1,1.00,0.10\n09/01/2026 09:31:00,SINGLE,SLD,1,TO CLOSE,/ESU26,,,,6001,O2,E2,0.50,0.05\n09/01/2026 09:32:00,SINGLE,SLD,1,TO CLOSE,/ESU26,,,,6002,O3,E3,0.50,0.05\n\nOrder History\n`
);

test('extracts only Thinkorswim Trade History execution section', () => {
  const section = extractThinkorswimTradeSection(TOS);
  assert.match(section, /Exec Time/);
  assert.match(section, /E3/);
  assert.doesNotMatch(section, /Order History/);
});

test('normalizes Thinkorswim futures executions with deterministic ES multiplier', async () => {
  const parsed = await parseThinkorswimExecutions(TOS);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.normalized.length, 3);
  assert.equal(parsed.normalized[0].side, 'buy');
  assert.equal(parsed.normalized[0].positionEffect, 'open');
  assert.equal(parsed.normalized[0].assetType, 'future');
  assert.equal(parsed.normalized[0].multiplier, 50);
  assert.equal(parsed.normalized[0].executionKey, 'id:E1');
});

test('unknown future remains normalized but unresolved so a user-owned specification can enrich it before persistence', async () => {
  const csv = Buffer.from(
    `Trade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Price\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,/ZZZU26,100\n`
  );
  const parsed = await parseThinkorswimExecutions(csv);
  assert.equal(parsed.normalized.length, 1);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.normalized[0].multiplier, null);
  assert.match(
    parsed.warnings.map((warning) => warning.message).join(' '),
    /instrument specification/i
  );
});

test('options preserve expiration, strike, call-put and use 100 multiplier', async () => {
  const csv = Buffer.from(
    `Trade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Exp,Strike,Type,Price,Exec ID\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,09/18/2026,250,CALL,3.50,OPT1\n`
  );
  const parsed = await parseThinkorswimExecutions(csv);
  assert.equal(parsed.errors.length, 0);
  const e = parsed.normalized[0];
  assert.equal(e.assetType, 'option');
  assert.equal(e.strike, 250);
  assert.equal(e.optionType, 'call');
  assert.equal(e.multiplier, 100);
});

test('malformed and valid rows are reported independently', async () => {
  const csv = Buffer.from(
    `Trade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Price,Exec ID\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,100,E1\n09/01/2026 09:31:00,SINGLE,WHAT,1,TO OPEN,AAPL,101,E2\n`
  );
  const parsed = await parseThinkorswimExecutions(csv);
  assert.equal(parsed.normalized.length, 1);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].rowNumber, 3);
});

test('identical fills without broker execution IDs receive stable occurrence keys', async () => {
  const csv = Buffer.from(
    `Trade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Price,Order ID\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,100,O1\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,100,O1\n`
  );
  const parsed = await parseThinkorswimExecutions(csv);
  assert.equal(parsed.normalized.length, 2);
  assert.notEqual(
    parsed.normalized[0].executionKey,
    parsed.normalized[1].executionKey
  );
  assert.match(parsed.normalized[1].executionKey, /occurrence:2$/);
});

test('naive Thinkorswim timestamps use the explicitly supplied statement timezone', async () => {
  const csv = Buffer.from(
    `Trade History\nExec Time,Spread,Side,Qty,Pos Effect,Symbol,Price,Exec ID\n09/01/2026 09:30:00,SINGLE,BOT,1,TO OPEN,AAPL,100,E1\n`
  );
  const parsed = await parseThinkorswimExecutions(csv, {
    sourceTimeZone: 'America/Los_Angeles',
  });
  assert.equal(parsed.errors.length, 0);
  assert.equal(
    parsed.normalized[0].timestamp.toISOString(),
    '2026-09-01T16:30:00.000Z'
  );
});
