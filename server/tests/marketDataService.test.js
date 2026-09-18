import test from 'node:test';
import assert from 'node:assert/strict';
import {
  writeFile,
  mkdir,
  readFile,
  symlink,
  truncate,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { createMarketDataService } from '../src/services/marketDataService.js';
import * as configuredService from '../src/services/marketDataService.js';
import { CandleCache } from '../src/services/marketData/CandleCache.js';
import { MarketDataProvider } from '../src/services/marketData/MarketDataProvider.js';
import {
  fixture,
  dataset,
  requestRange,
  OWNER,
  OTHER,
} from './fixtures/market-data/helpers.js';

const code = (expected) => (error) => error.code === expected;

test('CSV → normalizer → cache gives identical canonical results and legacy time aliases', async (t) => {
  const { provider } = await fixture(t);
  const original = provider.fetchCandles.bind(provider);
  let loads = 0;
  provider.fetchCandles = (...args) => {
    loads++;
    return original(...args);
  };
  const service = createMarketDataService({ provider });
  const first = await service.getCandles(requestRange);
  assert.equal(first.state, 'available');
  assert.equal(first.candles.length, 3);
  assert.equal(first.contractMetadata.contractMultiplier, 1);
  assert.equal(first.candles[2].volume, null);
  assert.deepEqual(await service.getCandles(requestRange), first);
  assert.equal(loads, 1);
  const narrow = await service.getCandles({
    ...requestRange,
    from: '2026-03-09T13:31:00Z',
  });
  assert.equal(narrow.candles.length, 2);
  assert.equal(loads, 1);
  first.candles[0].close = 999;
  assert.equal((await service.getCandles(requestRange)).candles[0].close, 101);
  const legacy = await service.fetchCandles(requestRange);
  assert.equal(legacy[0].time, legacy[0].timestamp);
  assert.equal(
    provider.getSessionHours(
      (await provider.describe({ ...requestRange })).dataset
    ).length,
    1
  );
  assert.equal(
    provider.normalizeTimestamp(requestRange.from),
    '2026-03-09T13:30:00.000Z'
  );
});

test('file replacement and manifest changes invalidate cache without process restart', async (t) => {
  const { provider, csvPath, manifestPath } = await fixture(t);
  const service = createMarketDataService({ provider });
  const first = await service.getCandles(requestRange);
  await writeFile(
    csvPath,
    'timestamp,open,high,low,close\n2026-03-09T13:31:00Z,1,2,0,1\n'
  );
  const second = await service.getCandles(requestRange);
  assert.notEqual(first.dataset.revision, second.dataset.revision);
  assert.equal(second.state, 'partial');
  assert.equal(second.diagnostics.missingBars, 2);
  await assert.rejects(
    () => service.fetchCandles(requestRange),
    code('MARKET_DATA_INCOMPLETE')
  );
  await writeFile(
    manifestPath,
    JSON.stringify({
      version: 1,
      datasets: [dataset({ priceBasis: 'adjusted' })],
    })
  );
  const third = await service.getCandles(requestRange);
  assert.equal(third.dataset.priceBasis, 'adjusted');
  assert.notEqual(third.dataset.revision, second.dataset.revision);
});

test('owner isolation applies to catalogs, source cache and contract metadata', async (t) => {
  const { root, provider } = await fixture(t);
  const service = createMarketDataService({ provider });
  assert.equal((await service.listDatasets(OWNER)).length, 1);
  assert.deepEqual(await service.listDatasets(OTHER), []);
  await assert.rejects(
    () => service.getCandles({ ...requestRange, userId: OTHER }),
    code('MARKET_DATA_UNAVAILABLE')
  );
  await mkdir(path.join(root, OTHER));
  await writeFile(
    path.join(root, OTHER, 'manifest.json'),
    JSON.stringify({ version: 1, datasets: [dataset()] })
  );
  await writeFile(
    path.join(root, OTHER, 'candles.csv'),
    'timestamp,open,high,low,close\n2026-03-09T13:30:00Z,1,1,1,1\n'
  );
  const owners = [];
  provider.contractResolver = async (input) => {
    owners.push(input.userId);
    return null;
  };
  assert.equal((await service.getCandles(requestRange)).candles[0].close, 101);
  assert.equal(
    (await service.getCandles({ ...requestRange, userId: OTHER })).candles[0]
      .close,
    1
  );
  assert.deepEqual(owners, [OWNER, OTHER]);
});

test('no provider, unsupported provider names and incomplete configuration remain unavailable', async (t) => {
  const saved = {
    provider: process.env.MARKET_DATA_PROVIDER,
    root: process.env.MARKET_DATA_LOCAL_ROOT,
  };
  t.after(() => {
    for (const [key, value] of [
      ['MARKET_DATA_PROVIDER', saved.provider],
      ['MARKET_DATA_LOCAL_ROOT', saved.root],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  delete process.env.MARKET_DATA_PROVIDER;
  delete process.env.MARKET_DATA_LOCAL_ROOT;
  assert.equal(configuredService.getProviderName(), 'none');
  for (const provider of ['none', 'unknown-vendor', 'local-csv']) {
    process.env.MARKET_DATA_PROVIDER = provider;
    assert.equal(configuredService.isConfigured(), false);
    assert.equal(
      (await configuredService.getStatus(OWNER)).state,
      'unconfigured'
    );
    await assert.rejects(
      () => configuredService.getCandles(requestRange),
      code('MARKET_DATA_NOT_CONFIGURED')
    );
    await assert.rejects(
      () => configuredService.listDatasets(OWNER),
      code('MARKET_DATA_NOT_CONFIGURED')
    );
  }
  const { root } = await fixture(t);
  process.env.MARKET_DATA_LOCAL_ROOT = root;
  assert.equal(configuredService.isConfigured(), true);
  assert.equal((await configuredService.getStatus(OWNER)).configured, true);
  assert.equal((await configuredService.listDatasets(OWNER)).length, 1);
  // Use an absent owner to avoid DB-backed contract resolution in this test.
  await assert.rejects(
    () => configuredService.fetchCandles({ ...requestRange, userId: OTHER }),
    code('MARKET_DATA_UNAVAILABLE')
  );
});

for (const [overrides, expected] of [
  [{ userId: undefined }, 'MARKET_DATA_OWNER_REQUIRED'],
  [{ userId: '../../etc' }, 'MARKET_DATA_OWNER_REQUIRED'],
  [{ symbol: '' }, 'MARKET_DATA_INVALID_SYMBOL'],
  [{ symbol: '/ESU26' }, 'MARKET_DATA_UNAVAILABLE'],
  [{ timeframe: '2m' }, 'MARKET_DATA_UNSUPPORTED_TIMEFRAME'],
  [{ timeframe: '1h' }, 'MARKET_DATA_UNAVAILABLE'],
  [{ datasetId: '../candles.csv' }, 'MARKET_DATA_INVALID_REQUEST'],
  [{ datasetId: 'foreign' }, 'MARKET_DATA_UNAVAILABLE'],
  [{ session: 'random' }, 'MARKET_DATA_UNSUPPORTED_SESSION'],
  [{ from: requestRange.to }, 'MARKET_DATA_INVALID_RANGE'],
  [{ from: '2026-03-08T00:00:00Z' }, 'MARKET_DATA_RANGE_UNAVAILABLE'],
  [{ to: '2026-03-10T00:00:00Z' }, 'MARKET_DATA_RANGE_UNAVAILABLE'],
]) {
  test(`rejects invalid/unsupported requests: ${JSON.stringify(overrides)}`, async (t) => {
    const { provider } = await fixture(t);
    await assert.rejects(
      () =>
        createMarketDataService({ provider }).getCandles({
          ...requestRange,
          ...overrides,
        }),
      code(expected)
    );
  });
}

test('no data is explicit, closed sessions are distinct, empty/partial ranges cannot feed backtests', async (t) => {
  const { provider, csvPath, manifestPath } = await fixture(t);
  const service = createMarketDataService({ provider });
  await writeFile(csvPath, 'timestamp,open,high,low,close\n');
  assert.equal((await service.getCandles(requestRange)).state, 'unavailable');
  await assert.rejects(
    () => service.fetchCandles(requestRange),
    code('MARKET_DATA_INCOMPLETE')
  );
  const item = dataset();
  item.calendar.sessions = [];
  await writeFile(
    manifestPath,
    JSON.stringify({ version: 1, datasets: [item] })
  );
  assert.equal((await service.getCandles(requestRange)).state, 'closed');
  await assert.rejects(
    () => service.fetchCandles(requestRange),
    code('MARKET_DATA_INCOMPLETE')
  );
});

test('ambiguous symbol/timeframe datasets require an explicit owned dataset ID', async (t) => {
  const { provider } = await fixture(t, [
    dataset(),
    dataset({ id: 'adjusted', priceBasis: 'adjusted' }),
  ]);
  const service = createMarketDataService({ provider });
  await assert.rejects(
    () => service.getCandles(requestRange),
    code('MARKET_DATA_AMBIGUOUS_DATASET')
  );
  assert.equal(
    (await service.getCandles({ ...requestRange, datasetId: 'adjusted' }))
      .dataset.priceBasis,
    'adjusted'
  );
});

test('provider implementation failures are sanitized and are not cached', async (t) => {
  const { provider } = await fixture(t);
  const original = provider.fetchCandles.bind(provider);
  provider.fetchCandles = async () => {
    throw new Error('/private/secret-file API_KEY=secret');
  };
  const service = createMarketDataService({ provider });
  await assert.rejects(
    () => service.getCandles(requestRange),
    (error) =>
      error.code === 'MARKET_DATA_PROVIDER_ERROR' &&
      !error.message.includes('secret')
  );
  provider.fetchCandles = original;
  assert.equal((await service.getCandles(requestRange)).state, 'available');
});

for (const manifest of [
  '{',
  JSON.stringify({ version: 2, datasets: [] }),
  JSON.stringify({ version: 1, datasets: [dataset(), dataset()] }),
]) {
  test('invalid manifests and duplicate dataset IDs are rejected', async (t) => {
    const { provider, manifestPath } = await fixture(t);
    await writeFile(manifestPath, manifest);
    await assert.rejects(
      () => createMarketDataService({ provider }).listDatasets(OWNER),
      code('MARKET_DATA_INVALID_MANIFEST')
    );
  });
}

for (const content of [
  '',
  'timestamp,open,high,low\n',
  'timestamp,open,high,low,close,close\n',
  'timestamp,open,high,low,close\n2026-03-09T13:30:00Z,1\n',
  `timestamp,open,high,low,close\n${'x'.repeat(9000)}\n`,
]) {
  test('malformed CSV structures fail before consumer access', async (t) => {
    const { provider, csvPath } = await fixture(t);
    await writeFile(csvPath, content);
    await assert.rejects(
      () => createMarketDataService({ provider }).getCandles(requestRange),
      code('MARKET_DATA_INVALID_CSV')
    );
  });
}

for (const file of ['../outside.csv', '/etc/passwd']) {
  test(`rejects manifest file escape ${file}`, async (t) => {
    const { provider } = await fixture(t, [dataset({ file })]);
    await assert.rejects(
      () => createMarketDataService({ provider }).getCandles(requestRange),
      code('MARKET_DATA_INVALID_SOURCE')
    );
  });
}

test('rejects symlink escapes, oversized files, directories, deleted and changing sources', async (t) => {
  const { provider, csvPath, root, ownerDir } = await fixture(t);
  const service = createMarketDataService({ provider });
  const description = await provider.describe(requestRange);
  await writeFile(csvPath, 'changed');
  await assert.rejects(
    () => provider.fetchCandles(description),
    code('MARKET_DATA_SOURCE_CHANGED')
  );
  await truncate(csvPath, 17 * 1024 * 1024);
  await assert.rejects(
    () => service.getCandles(requestRange),
    code('MARKET_DATA_LIMIT_EXCEEDED')
  );
  await rm(csvPath);
  await mkdir(csvPath);
  await assert.rejects(
    () => service.getCandles(requestRange),
    code('MARKET_DATA_INVALID_SOURCE')
  );
  await rm(csvPath, { recursive: true });
  await writeFile(path.join(root, 'outside.csv'), 'private');
  await symlink(path.join(root, 'outside.csv'), csvPath);
  await assert.rejects(
    () => service.getCandles(requestRange),
    code('MARKET_DATA_INVALID_SOURCE')
  );
  await rm(csvPath);
  await assert.rejects(
    () => service.getCandles(requestRange),
    code('MARKET_DATA_PROVIDER_ERROR')
  );
  await symlink(ownerDir, path.join(root, OTHER));
  await assert.rejects(
    () => service.listDatasets(OTHER),
    code('MARKET_DATA_INVALID_SOURCE')
  );
});

test('CSV BOM, quoted decimals, empty volume, and local timestamps are supported', async (t) => {
  const { provider, csvPath } = await fixture(t, [
    dataset({ timestampFormat: 'local' }),
  ]);
  await writeFile(
    csvPath,
    '\uFEFFtimestamp,open,high,low,close,volume\n2026-03-09T09:30:00,"1.5",2,1,1.75,\n'
  );
  const result = await createMarketDataService({ provider }).getCandles(
    requestRange
  );
  assert.equal(result.candles[0].timestamp, '2026-03-09T13:30:00.000Z');
  assert.equal(result.candles[0].open, 1.5);
  assert.equal(result.candles[0].volume, null);
});

test('abstract provider declares mandatory operations and reuses contract resolver', async () => {
  const provider = new MarketDataProvider('test', {
    contractResolver: async (input) => input,
  });
  for (const method of ['listDatasets', 'describe', 'fetchCandles'])
    await assert.rejects(
      () => provider[method](),
      code('MARKET_DATA_NOT_IMPLEMENTED')
    );
  assert.deepEqual(await provider.getContractMetadata(OWNER, dataset()), {
    userId: OWNER,
    symbol: 'AAPL',
    assetType: 'equity',
  });
});

test('cache coalesces concurrent requests, clones returns, expires, and evicts LRU', async () => {
  let now = 0;
  let loads = 0;
  const cache = new CandleCache({ maxEntries: 2, ttlMs: 10, now: () => now });
  const loader = async () => {
    loads++;
    return { close: 1 };
  };
  const [first, second] = await Promise.all([
    cache.getOrLoad('a', loader),
    cache.getOrLoad('a', loader),
  ]);
  assert.equal(loads, 1);
  first.close = 99;
  assert.equal(second.close, 1);
  await cache.getOrLoad('b', loader);
  await cache.getOrLoad('a', loader);
  await cache.getOrLoad('c', loader);
  await cache.getOrLoad('b', loader);
  assert.equal(loads, 4);
  now = 11;
  await cache.getOrLoad('b', loader);
  assert.equal(loads, 5);
});

test('cache bounds bytes, concurrent work, and never caches failed loads', async () => {
  const cache = new CandleCache({ maxBytes: 20, maxPending: 1 });
  let release;
  const pending = cache.getOrLoad(
    'a',
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  await Promise.resolve();
  await assert.rejects(
    () => cache.getOrLoad('b', async () => 1),
    code('MARKET_DATA_BUSY')
  );
  release('ok');
  await pending;
  await cache.getOrLoad('large', async () => 'x'.repeat(30));
  assert.equal(cache.entries.has('large'), false);
  await assert.rejects(() =>
    cache.getOrLoad('error', async () => {
      throw new Error('error');
    })
  );
  assert.equal(await cache.getOrLoad('error', async () => 2), 2);
  const disabled = new CandleCache({ maxEntries: 0 });
  await disabled.getOrLoad('a', async () => 1);
  assert.equal(disabled.entries.size, 0);
});

test('catalog exposes no filesystem paths', async (t) => {
  const { provider, root } = await fixture(t);
  const listed = await createMarketDataService({ provider }).listDatasets(
    OWNER
  );
  assert.equal(listed[0].file, undefined);
  assert.ok(!JSON.stringify(listed).includes(root));
  // Ensure the fixture, not runtime production data, is used throughout this suite.
  assert.match(
    await readFile(path.join(root, OWNER, 'candles.csv'), 'utf8'),
    /timestamp/
  );
});

test('missing contract metadata is explicit and current metadata is not hidden by cached candles', async (t) => {
  const { provider } = await fixture(t);
  provider.contractResolver = async () => null;
  const service = createMarketDataService({ provider });
  const first = await service.getCandles(requestRange);
  assert.equal(first.contractMetadata, null);
  assert.ok(
    first.diagnostics.warnings.some(
      (warning) => warning.code === 'CONTRACT_METADATA_UNAVAILABLE'
    )
  );
  provider.contractResolver = async () => ({
    contractMultiplier: 25,
    source: 'user',
  });
  const second = await service.getCandles(requestRange);
  assert.equal(second.contractMetadata.contractMultiplier, 25);
  assert.ok(
    !second.diagnostics.warnings.some(
      (warning) => warning.code === 'CONTRACT_METADATA_UNAVAILABLE'
    )
  );
  assert.deepEqual(second.candles, first.candles);
});

test('large source row counts are rejected and direct adapter ownership cannot traverse files', async (t) => {
  const { provider, csvPath } = await fixture(t);
  await assert.rejects(
    () => provider.catalog('../'),
    code('MARKET_DATA_OWNER_REQUIRED')
  );
  await writeFile(
    csvPath,
    'timestamp,open,high,low,close\n' +
      '2026-03-09T13:30:00Z,1,1,1,1\n'.repeat(100_001)
  );
  await assert.rejects(
    () => createMarketDataService({ provider }).getCandles(requestRange),
    code('MARKET_DATA_LIMIT_EXCEEDED')
  );
});

test('cache evicts on byte budget as well as entry count', async () => {
  const cache = new CandleCache({ maxEntries: 10, maxBytes: 12 });
  await cache.getOrLoad('a', async () => 'aaaaaa');
  await cache.getOrLoad('b', async () => 'bbbbbb');
  assert.equal(cache.entries.has('a'), false);
  assert.equal(cache.entries.has('b'), true);
  assert.equal(cache.bytes, 8);
});

test('an additional adapter can feed the same normalization/cache contract without local files', async () => {
  const { normalizeCalendar } =
    await import('../src/services/marketData/calendar.js');
  class FixtureProvider extends MarketDataProvider {
    constructor() {
      super('fixture-provider', { contractResolver: async () => null });
    }
    async describe() {
      const item = dataset();
      delete item.file;
      return {
        dataset: {
          ...item,
          calendar: normalizeCalendar(item.calendar, item.timezone),
        },
        revision: 'fixture-v1',
      };
    }
    async fetchCandles() {
      return [
        { timestamp: requestRange.from, open: 1, high: 2, low: 0, close: 1 },
      ];
    }
  }
  const service = createMarketDataService({ provider: new FixtureProvider() });
  const result = await service.getCandles(requestRange);
  assert.equal(result.dataset.provider, 'fixture-provider');
  assert.equal(result.state, 'partial');
  assert.deepEqual(await service.getCandles(requestRange), result);
});

test('legacy consumers can require a confirmed unit multiplier without restricting canonical futures access', async (t) => {
  const { provider } = await fixture(t);
  const service = createMarketDataService({ provider });
  for (const metadata of [
    null,
    { contractMultiplier: 50 },
    { contractMultiplier: 0 },
  ]) {
    provider.contractResolver = async () => metadata;
    assert.equal((await service.getCandles(requestRange)).state, 'available');
    await assert.rejects(
      () =>
        service.fetchCandles({ ...requestRange, requireContractMultiplier: 1 }),
      code('MARKET_DATA_UNSUPPORTED_CONTRACT')
    );
  }
  provider.contractResolver = async () => ({ contractMultiplier: 1 });
  assert.equal(
    (
      await service.fetchCandles({
        ...requestRange,
        requireContractMultiplier: 1,
      })
    ).length,
    3
  );
});
