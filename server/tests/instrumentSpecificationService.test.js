import test from 'node:test';
import assert from 'node:assert/strict';
import {
  futureRoot,
  getBuiltinInstrumentSpecification,
  resolveInstrumentSpecificationSync,
} from '../src/services/instrumentSpecificationService.js';
import { normalizeExecution } from '../src/services/executionNormalizationService.js';
import { computeTradeFinancials } from '../src/services/calculationsService.js';
import InstrumentSpecification from '../src/models/InstrumentSpecification.js';
import BrokerExecution from '../src/models/BrokerExecution.js';

test('ES and MES specifications are represented with authoritative tick and point values', () => {
  const es = getBuiltinInstrumentSpecification('/ESZ26', 'future');
  const mes = getBuiltinInstrumentSpecification('/MESZ26', 'future');
  assert.equal(futureRoot('/ESZ26'), 'ES');
  assert.deepEqual(
    {
      tickSize: es.tickSize,
      tickValue: es.tickValue,
      pointValue: es.pointValue,
      multiplier: es.contractMultiplier,
    },
    { tickSize: 0.25, tickValue: 12.5, pointValue: 50, multiplier: 50 }
  );
  assert.deepEqual(
    {
      tickSize: mes.tickSize,
      tickValue: mes.tickValue,
      pointValue: mes.pointValue,
      multiplier: mes.contractMultiplier,
    },
    { tickSize: 0.25, tickValue: 1.25, pointValue: 5, multiplier: 5 }
  );
});

test('execution normalization resolves futures multipliers through the centralized specification service', () => {
  const result = normalizeExecution({
    broker: 'thinkorswim',
    symbol: '/ESZ26',
    assetType: 'future',
    side: 'BUY',
    quantity: 2,
    price: 6000,
    timestamp: '2026-09-01T14:30:00Z',
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.execution.multiplier, 50);
  assert.equal(result.execution.multiplierSource, 'contract-spec');
});

test('options resolve to the standard 100 contract multiplier through the same path', () => {
  const spec = resolveInstrumentSpecificationSync({
    symbol: 'SPY',
    assetType: 'option',
  });
  assert.equal(spec.contractMultiplier, 100);
});

test('unknown future remains unresolved instead of silently guessing multiplier 1', () => {
  const result = normalizeExecution({
    broker: 'generic',
    symbol: '/UNKNOWNZ26',
    assetType: 'future',
    side: 'BUY',
    quantity: 1,
    price: 100,
    timestamp: '2026-09-01T14:30:00Z',
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.execution.multiplier, null);
  assert.match(result.warnings.join(' '), /instrument specification/i);
});

test('ES financial calculations remain correct when using the centralized multiplier', () => {
  const spec = getBuiltinInstrumentSpecification('ES', 'future');
  const result = computeTradeFinancials({
    direction: 'long',
    quantity: 2,
    entryPrice: 6000,
    exitPrice: 6002,
    entryTime: '2026-09-01T14:30:00Z',
    exitTime: '2026-09-01T14:35:00Z',
    multiplier: spec.contractMultiplier,
    stopLoss: 5999,
    fees: 0,
    commission: 0,
  });
  assert.equal(result.grossPnL, 200);
  assert.equal(result.rMultiple, 2);
});

test('custom instrument specifications require ownership and enforce one symbol/type per user', () => {
  assert.equal(
    InstrumentSpecification.schema.path('userId').options.required,
    true
  );
  const index = InstrumentSpecification.schema
    .indexes()
    .find(
      ([fields, options]) =>
        fields.userId === 1 &&
        fields.symbol === 1 &&
        fields.assetType === 1 &&
        options.unique
    );
  assert.ok(index, 'expected unique userId + symbol + assetType index');
});

test('user-owned custom specification overrides the built-in contract metadata', async () => {
  const original = InstrumentSpecification.findOne;
  InstrumentSpecification.findOne = (filter) => ({
    lean: async () => ({
      userId: filter.userId,
      symbol: 'ES',
      assetType: 'future',
      contractMultiplier: 25,
      tickSize: 0.25,
      tickValue: 6.25,
      pointValue: 25,
      source: 'user',
      isActive: true,
    }),
  });
  try {
    const { resolveInstrumentSpecification } =
      await import('../src/services/instrumentSpecificationService.js');
    const spec = await resolveInstrumentSpecification({
      userId: 'user-1',
      symbol: '/ESZ26',
      assetType: 'future',
    });
    assert.equal(spec.contractMultiplier, 25);
    assert.equal(spec.source, 'user');
  } finally {
    InstrumentSpecification.findOne = original;
  }
});

test('execution enrichment applies a user specification and records auditable multiplier source', async () => {
  const original = InstrumentSpecification.findOne;
  InstrumentSpecification.findOne = () => ({
    lean: async () => ({
      symbol: 'ZZZ',
      assetType: 'future',
      contractMultiplier: 10,
      source: 'user',
      isActive: true,
    }),
  });
  try {
    const { enrichExecutionWithInstrumentSpecification } =
      await import('../src/services/instrumentSpecificationService.js');
    const enriched = await enrichExecutionWithInstrumentSpecification(
      'user-1',
      {
        symbol: '/ZZZU26',
        assetType: 'future',
        multiplier: null,
        multiplierSource: null,
      }
    );
    assert.equal(enriched.multiplier, 10);
    assert.equal(enriched.multiplierSource, 'user-spec');
    assert.ok(
      BrokerExecution.schema
        .path('multiplierSource')
        .enumValues.includes('user-spec')
    );
  } finally {
    InstrumentSpecification.findOne = original;
  }
});

test('central resolver covers non-future defaults, custom miss fallback, broker precedence and batch rejection', async () => {
  const module =
    await import('../src/services/instrumentSpecificationService.js');
  const equity = module.getBuiltinInstrumentSpecification('AAPL', 'equity');
  assert.equal(equity.contractMultiplier, 1);
  assert.equal(equity.pointValue, 1);

  const original = InstrumentSpecification.findOne;
  InstrumentSpecification.findOne = () => ({ lean: async () => null });
  try {
    const fallback = await module.resolveInstrumentSpecification({
      userId: 'u',
      symbol: '/MESZ26',
      assetType: 'future',
    });
    assert.equal(fallback.contractMultiplier, 5);
    const missing = await module.resolveInstrumentSpecification({
      userId: 'u',
      symbol: '/ZZZU26',
      assetType: 'future',
    });
    assert.equal(missing, null);

    const brokerExecution = {
      symbol: '/ESZ26',
      assetType: 'future',
      multiplier: 25,
      multiplierSource: 'broker',
    };
    assert.equal(
      await module.enrichExecutionWithInstrumentSpecification(
        'u',
        brokerExecution
      ),
      brokerExecution
    );

    await assert.rejects(
      () =>
        module.enrichExecutionWithInstrumentSpecification('u', {
          symbol: '/ZZZU26',
          assetType: 'future',
          multiplier: null,
        }),
      (error) => error.code === 'INSTRUMENT_SPEC_REQUIRED'
    );

    const batch = await module.enrichExecutionsWithInstrumentSpecifications(
      'u',
      [
        {
          symbol: '/ESZ26',
          assetType: 'future',
          multiplier: null,
          multiplierSource: null,
        },
        {
          symbol: '/ZZZU26',
          assetType: 'future',
          multiplier: null,
          multiplierSource: null,
        },
      ]
    );
    assert.equal(batch.accepted.length, 1);
    assert.equal(batch.rejected.length, 1);
    assert.equal(batch.accepted[0].multiplier, 50);
  } finally {
    InstrumentSpecification.findOne = original;
  }
});
