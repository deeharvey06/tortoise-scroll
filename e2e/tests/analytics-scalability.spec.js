import { test, expect } from '@playwright/test';

test('scalable analytics retain authenticated account/date filters and compact summary parity', async ({
  page,
  request,
}) => {
  for (const route of ['dashboard', 'summary', 'calendar?year=2025&month=2']) {
    expect((await request.get(`/api/analytics/${route}`)).status()).toBe(401);
  }
  const credentials = {
    email: `analytics-${Date.now()}@example.test`,
    password: 'analytics-parity-test-password',
    displayName: 'Analytics fixture',
  };
  expect(
    (
      await page.request.post('/api/auth/register', { data: credentials })
    ).status(),
  ).toBe(201);
  await page.request.post('/api/auth/login', {
    data: { email: credentials.email, password: credentials.password },
  });
  const account = await (
    await page.request.post('/api/accounts', {
      data: {
        name: 'Analytics fixture',
        currency: 'USD',
        startingBalance: 10000,
      },
    })
  ).json();
  for (const [i, exitPrice] of [102, 99, 100].entries()) {
    const response = await page.request.post('/api/trades', {
      data: {
        accountId: account._id,
        symbol: 'AAPL',
        direction: 'long',
        quantity: 1,
        entryPrice: 100,
        exitPrice,
        entryTime: `2025-02-0${i + 1}T10:00:00Z`,
        exitTime: `2025-02-0${i + 1}T11:00:00Z`,
        stopLoss: 99,
        session: 'open',
        setup: 'Fixture',
      },
    });
    expect(response.status()).toBe(201);
  }
  const qs = `accountId=${account._id}&dateFrom=2025-02-01&dateTo=2025-02-28`;
  const dashboard = await (
    await page.request.get(`/api/analytics/dashboard?${qs}`)
  ).json();
  const compactResponse = await page.request.get(
    `/api/analytics/summary?${qs}`,
  );
  expect(compactResponse.ok()).toBeTruthy();
  const compact = await compactResponse.json();
  expect(compact.summary).toEqual(dashboard.summary);
  expect(compact.summary.netPnL).toBe(1);
  expect(compact.summary.totalTrades).toBe(3);
  expect(compact.equityCurve).toBeUndefined();
  expect(compact.winLossDistribution).toEqual(dashboard.winLossDistribution);
  expect(compact.rMultipleDistribution).toEqual(
    dashboard.rMultipleDistribution,
  );
  const report = await (
    await page.request.get(`/api/reports/performance?${qs}`)
  ).json();
  expect(report).toEqual(compact);
  const market = await (
    await page.request.get(`/api/reports/market?${qs}`)
  ).json();
  expect(market.bySymbol).toEqual(dashboard.bySymbol);
  expect(market.sampleSize).toBe(3);
  const calendar = await (
    await page.request.get(`/api/analytics/calendar?${qs}&year=2025&month=2`)
  ).json();
  expect(calendar.days).toEqual(dashboard.dailyStats);
  const stranger = {
    email: `analytics-other-${Date.now()}@example.test`,
    password: 'analytics-other-test-password',
    displayName: 'Other owner',
  };
  await request.post('/api/auth/register', { data: stranger });
  await request.post('/api/auth/login', {
    data: { email: stranger.email, password: stranger.password },
  });
  for (const route of ['dashboard', 'summary']) {
    const foreign = await (
      await request.get(`/api/analytics/${route}?${qs}`)
    ).json();
    expect(foreign.summary.totalTrades).toBe(0);
    expect(foreign.summary.netPnL).toBeNull();
  }
});
