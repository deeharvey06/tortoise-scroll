import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalCsvProvider } from '../../../src/services/marketData/LocalCsvProvider.js';
import { getBuiltinInstrumentSpecification } from '../../../src/services/instrumentSpecificationService.js';

export const OWNER = '64b000000000000000000001';
export const OTHER = '64b000000000000000000002';
export const requestRange = {
  userId: OWNER,
  symbol: 'AAPL',
  timeframe: '1m',
  from: '2026-03-09T13:30:00Z',
  to: '2026-03-09T13:33:00Z',
};
export function dataset(overrides = {}) {
  return {
    id: 'aapl-minute',
    symbol: 'AAPL',
    timeframe: '1m',
    assetType: 'equity',
    file: 'candles.csv',
    timezone: 'America/New_York',
    timestampFormat: 'offset',
    timestampConvention: 'start',
    priceBasis: 'unadjusted',
    calendar: {
      from: requestRange.from,
      to: requestRange.to,
      timestampFormat: 'offset',
      sessions: [
        {
          tradingDate: '2026-03-09',
          kind: 'rth',
          start: requestRange.from,
          end: requestRange.to,
        },
      ],
    },
    ...overrides,
  };
}
export async function fixture(t, items = [dataset()]) {
  const root = await mkdtemp(path.join(tmpdir(), 'tortoise-market-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ownerDir = path.join(root, OWNER);
  await mkdir(ownerDir);
  const manifestPath = path.join(ownerDir, 'manifest.json');
  const csvPath = path.join(ownerDir, 'candles.csv');
  await writeFile(
    manifestPath,
    JSON.stringify({ version: 1, datasets: items })
  );
  await copyFile(
    fileURLToPath(new URL('./candles.csv', import.meta.url)),
    csvPath
  );
  const provider = new LocalCsvProvider({
    root,
    contractResolver: async ({ symbol, assetType }) =>
      getBuiltinInstrumentSpecification(symbol, assetType),
  });
  return { root, ownerDir, manifestPath, csvPath, provider };
}
