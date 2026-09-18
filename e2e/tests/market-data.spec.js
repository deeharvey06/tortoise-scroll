import { test, expect } from '@playwright/test';
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../.tmp-market-data/', import.meta.url));
const range = {
  symbol: 'AAPL',
  timeframe: '1m',
  from: '2026-03-09T13:30:00Z',
  to: '2026-03-09T13:33:00Z',
};
const manifest = {
  version: 1,
  datasets: [
    {
      id: 'fixture',
      symbol: 'AAPL',
      timeframe: '1m',
      assetType: 'equity',
      file: 'candles.csv',
      timezone: 'America/New_York',
      timestampFormat: 'offset',
      timestampConvention: 'start',
      priceBasis: 'unadjusted',
      calendar: {
        from: range.from,
        to: range.to,
        timestampFormat: 'offset',
        sessions: [
          {
            kind: 'rth',
            tradingDate: '2026-03-09',
            start: range.from,
            end: range.to,
          },
        ],
      },
    },
  ],
};

test('local historical candles stay deterministic and private through authenticated APIs; Replay still discloses fills only', async ({
  page,
  request,
}) => {
  const user = {
    email: `market-${Date.now()}@example.test`,
    displayName: 'Market data test',
    password: 'market-data-test-password-123',
  };
  expect(
    (await page.request.post('/api/auth/register', { data: user })).status(),
  ).toBe(201);
  const login = await page.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password },
  });
  expect(login.status()).toBe(200);
  const owner = (await login.json()).user.id;
  const ownerDir = path.join(root, owner);
  await mkdir(ownerDir, { recursive: true });
  try {
    await writeFile(
      path.join(ownerDir, 'manifest.json'),
      JSON.stringify(manifest),
    );
    // These deliberately artificial candles are test fixtures only, never bundled into a live catalog.
    await copyFile(
      fileURLToPath(
        new URL(
          '../../server/tests/fixtures/market-data/candles.csv',
          import.meta.url,
        ),
      ),
      path.join(ownerDir, 'candles.csv'),
    );
    const status = await page.request.get('/api/market-data/status');
    expect(await status.json()).toMatchObject({
      configured: true,
      provider: 'local-csv',
    });
    const query = new URLSearchParams(range).toString();
    const firstResponse = await page.request.get(
      `/api/market-data/candles?${query}`,
    );
    expect(firstResponse.status()).toBe(200);
    const first = await firstResponse.json();
    expect(first.state).toBe('available');
    expect(first.candles).toHaveLength(3);
    expect(first.candles[0].timestamp).toBe('2026-03-09T13:30:00.000Z');
    expect(
      await (
        await page.request.get(`/api/market-data/candles?${query}`)
      ).json(),
    ).toEqual(first);
    expect(
      (await request.get(`/api/market-data/candles?${query}`)).status(),
    ).toBe(401);
    const foreign = {
      email: `market-other-${Date.now()}@example.test`,
      displayName: 'Other user',
      password: 'market-data-test-password-123',
    };
    await request.post('/api/auth/register', { data: foreign });
    expect(
      (
        await request.post('/api/auth/login', {
          data: { email: foreign.email, password: foreign.password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get(
          `/api/market-data/candles?${query}&userId=${owner}&datasetId=fixture`,
        )
      ).status(),
    ).toBe(404);

    const accountResponse = await page.request.post('/api/accounts', {
      data: { name: 'Market test account' },
    });
    const account = await accountResponse.json();
    expect(accountResponse.status()).toBe(201);
    expect(
      (
        await page.request.post('/api/trades', {
          data: {
            accountId: account._id,
            symbol: 'AAPL',
            direction: 'long',
            quantity: 1,
            entryPrice: 100,
            exitPrice: 101,
            entryTime: range.from,
            exitTime: range.to,
          },
        })
      ).status(),
    ).toBe(201);
    await page.goto('/replay');
    await page.getByRole('tab', { name: 'Trade review', exact: true }).click();
    await page.getByLabel('Session date').fill('2026-03-09');
    await page.getByRole('button', { name: 'Load session' }).click();
    await expect(
      page.getByText(/chart below plots only your actual logged/),
    ).toBeVisible();

    await writeFile(
      path.join(ownerDir, 'candles.csv'),
      'timestamp,open,high,low,close\n2026-03-09T13:30:00Z,100,102,99,101\n',
    );
    const partial = await (
      await page.request.get(`/api/market-data/candles?${query}`)
    ).json();
    expect(partial.state).toBe('partial');
    expect(partial.diagnostics.missingBars).toBe(2);
    expect(partial.candles).toHaveLength(1);
    await writeFile(
      path.join(ownerDir, 'candles.csv'),
      'timestamp,open,high,low,close\n2026-03-09T13:30:00Z,100,1,99,101\n',
    );
    const invalid = await page.request.get(`/api/market-data/candles?${query}`);
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).error.code).toBe(
      'MARKET_DATA_INVALID_CANDLE',
    );
  } finally {
    await rm(ownerDir, { recursive: true, force: true });
  }
});
