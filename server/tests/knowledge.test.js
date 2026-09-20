import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProcess,
  contextStatistics,
  matchesContext,
} from '../src/services/knowledge/processAnalytics.js';
import {
  parse,
  itemInput,
  planInput,
  tradeContextInput,
  preparationInput,
} from '../src/services/knowledge/schema.js';
import {
  extractPages,
  hash,
  readArchive,
} from '../src/services/knowledge/ingestion.js';
import { restoredKnowledge } from '../src/services/knowledge/backup.js';
const a = '111111111111111111111111',
  b = '222222222222222222222222';
const trade = {
  direction: 'long',
  quantity: 2,
  entryPrice: 101,
  entryTime: '2026-01-02T15:00:00Z',
  stopLoss: 98,
  riskAmount: 6,
  exitPrice: 104,
  exitTime: '2026-01-02T16:00:00Z',
  netPnL: 6,
  rMultiple: 1,
  methodology: {
    plan: {
      entry: 100,
      stop: 99,
      size: 1,
      risk: 1,
      maxAdverseEntryDeviation: 0.5,
      earliestEntry: '2026-01-02T15:01:00Z',
    },
    snapshot: [{ knowledgeId: a }, { knowledgeId: b }],
  },
};
test('process derives only evidenced plan deviations, with definitions and no input mutation', () => {
  const before = JSON.stringify(trade);
  const result = evaluateProcess(trade);
  assert.deepEqual(
    result.findings.map((f) => f.code),
    [
      'Oversized',
      'Planned Risk Exceeded',
      'Stop Differs From Plan',
      'Early Entry',
      'Chased Entry',
    ]
  );
  for (const f of result.findings) {
    assert.ok(f.definition);
    assert.ok(Object.keys(f.evidence).length >= 2);
  }
  assert.equal(JSON.stringify(trade), before);
  assert.deepEqual(evaluateProcess(trade), result);
});
test('missing plans and unknown values never create classifications', () => {
  assert.equal(evaluateProcess({}).findings.length, 0);
  assert.equal(
    evaluateProcess({
      methodology: { plan: { size: null, risk: null, stop: null } },
    }).findings.length,
    0
  );
  assert.equal(
    evaluateProcess({
      ...trade,
      methodology: {
        plan: {
          size: 2,
          risk: 6,
          stop: 98,
          entry: 101,
          maxAdverseEntryDeviation: 0,
        },
      },
    }).findings.length,
    0
  );
});
test('short adverse deviation is directional; exact thresholds do not violate plan', () => {
  const t = {
    ...trade,
    direction: 'short',
    entryPrice: 99,
    methodology: { plan: { entry: 100, maxAdverseEntryDeviation: 1 } },
  };
  assert.equal(evaluateProcess(t).findings.length, 0);
  t.entryPrice = 98.75;
  assert.equal(evaluateProcess(t).findings[0].code, 'Chased Entry');
});
test('timestamps respect offsets; explicit fill counts count split executions honestly', () => {
  const t = {
    ...trade,
    executions: [{ side: 'buy' }, { side: 'buy' }, { side: 'sell' }],
    methodology: {
      plan: { latestEntry: '2026-01-02T06:59:00-08:00', maxEntryFills: 1 },
    },
  };
  assert.deepEqual(
    evaluateProcess(t).findings.map((f) => f.code),
    ['Late Entry', 'Entry Fill Count Exceeded']
  );
  t.methodology.plan.latestEntry = '2026-01-02T07:00:00-08:00';
  assert.equal(
    evaluateProcess(t).findings[0].code,
    'Entry Fill Count Exceeded'
  );
});
test('context filters use AND combinations and tri-state manual review', () => {
  assert.equal(matchesContext(trade, { knowledgeIds: [a, b] }), true);
  assert.equal(
    matchesContext(trade, { knowledgeIds: [a, '333333333333333333333333'] }),
    false
  );
  assert.equal(matchesContext(trade, { scenarioMatched: false }), false);
  assert.equal(matchesContext(trade, { followedPlan: false }), false);
  assert.equal(
    matchesContext({ ...trade, followedPlan: false }, { followedPlan: false }),
    true
  );
  assert.equal(matchesContext(trade, { process: 'Oversized' }), true);
});
test('context statistics use Decimal, R coverage, initial-loss drawdown, and real closed samples', () => {
  const values = [
    { ...trade, netPnL: -10, rMultiple: -1 },
    { ...trade, netPnL: 20, rMultiple: 2, exitTime: '2026-01-03T16:00:00Z' },
    { ...trade, netPnL: null, exitTime: null },
  ];
  const r = contextStatistics(values);
  assert.equal(r.sampleSize, 2);
  assert.equal(r.rSampleSize, 2);
  assert.equal(r.netPnL, 10);
  assert.equal(r.totalR, 1);
  assert.equal(r.avgR, 0.5);
  assert.equal(r.expectancy, 5);
  assert.equal(r.profitFactor, 2);
  assert.equal(r.maxDrawdown, -10);
  assert.equal(r.winRate, 50);
  assert.equal(contextStatistics([]).netPnL, null);
  assert.equal(contextStatistics([{ ...trade, rMultiple: null }]).totalR, null);
  assert.equal(
    contextStatistics([
      { ...trade, netPnL: 0.1 },
      { ...trade, netPnL: 0.2 },
    ]).netPnL,
    0.3
  );
});
test('strict knowledge schemas reject client approval and unconditional probability extraction', () => {
  const value = {
    name: 'Source example',
    kind: 'concept',
    references: [{ sourceId: a, sectionId: 'page-1' }],
  };
  assert.equal(parse(itemInput, value).interpretation, '');
  assert.throws(
    () => parse(itemInput, { ...value, status: 'approved' }),
    /Unrecognized/
  );
  assert.throws(
    () => parse(itemInput, { ...value, kind: 'probability' }),
    /contextual/
  );
  assert.throws(
    () => parse(tradeContextInput, { revision: 0, userId: b }),
    /Unrecognized/
  );
  assert.throws(() => parse(planInput, { size: -1 }), />0/);
  assert.throws(() => parse(preparationInput, { knowledgeIds: ['not-an-id'] }));
});
test('source text is preserved verbatim, invalid PDFs/ZIPs fail explicitly, checksums reproducible', async () => {
  const source = Buffer.from(
    'Context\nApproximately 60% only if A; except B.\n'
  );
  assert.deepEqual(await extractPages(source, 'txt'), [
    { page: 1, text: source.toString() },
  ]);
  assert.equal(hash(source), hash(source));
  await assert.rejects(
    () => extractPages(Buffer.from('bad'), 'pdf'),
    /Invalid PDF/
  );
  await assert.rejects(() => readArchive(Buffer.from('bad')), /Invalid ZIP/);
  await assert.rejects(
    () => extractPages(Buffer.alloc(10 * 1024 * 1024 + 1), 'txt'),
    /10 MB/
  );
});
test('backup restoration never silently approves knowledge', () => {
  const doc = {
    status: 'approved',
    verifiedAt: new Date(),
    revision: 3,
    interpretation: 'Retain me',
  };
  const r = restoredKnowledge('knowledgeItems', doc);
  assert.equal(r.status, 'needs_review');
  assert.equal(r.verifiedAt, null);
  assert.equal(r.interpretation, doc.interpretation);
  assert.equal(doc.status, 'approved');
});

test('planning windows compare instants rather than offset string ordering', () => {
  assert.doesNotThrow(() =>
    parse(planInput, {
      earliestEntry: '2026-01-02T10:00:00+02:00',
      latestEntry: '2026-01-02T09:00:00Z',
    })
  );
  assert.throws(
    () =>
      parse(planInput, {
        earliestEntry: '2026-01-02T09:00:00Z',
        latestEntry: '2026-01-02T10:00:00+02:00',
      }),
    /reversed/
  );
});

test('PDF extraction returns actual page text without inventing claims', async () => {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream =
    'BT /F1 12 Tf 72 720 Td (Synthetic conditional note: only if A.) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((v) => String(v).padStart(10, '0') + ' 00000 n ')
    .join(
      '\n'
    )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const pages = await extractPages(Buffer.from(pdf), 'pdf');
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Synthetic conditional note: only if A/);
});
