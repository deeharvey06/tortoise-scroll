import { test, expect } from '@playwright/test';
import { authenticateAsDemo } from './helpers.js';

test('workspace header stays mounted and aligned during navigation and data loading', async ({ page, request }) => {
  await authenticateAsDemo(page, request);
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto('/trades');
  await expect(page.getByRole('heading', { name: 'Trades', exact: true })).toBeVisible();
  const header = page.locator('header').first();
  await expect(header.getByText('API connected', { exact: true })).toBeVisible();
  await header.evaluate((element) => { window.workspaceHeader = element; });
  const before = await header.boundingBox();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/accounts', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.getByRole('link', { name: 'Accounts', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Loading accounts and instruments…' })).toBeVisible();
    expect(await header.evaluate((element) => element === window.workspaceHeader)).toBe(true);
    const during = await header.boundingBox();
    expect(during.x).toBe(before.x);
    expect(during.width).toBe(before.width);
    expect(during.height).toBe(before.height);
    await expect(header.getByText('API connected', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter)).toBe('stable');
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'Accounts & Instruments', exact: true })).toBeVisible();
  expect(await header.evaluate((element) => element === window.workspaceHeader)).toBe(true);
  const after = await header.boundingBox();
  expect(after.width).toBe(before.width);
});

test('trade search keeps existing rows mounted until the new results arrive', async ({ page }) => {
  const credentials = {
    email: `loading-${Date.now()}@example.test`,
    password: 'loading-stability-password-123',
    displayName: 'Loading stability',
  };
  expect((await page.request.post('/api/auth/register', { data: credentials })).ok()).toBeTruthy();
  expect((await page.request.post('/api/auth/login', {
    data: { email: credentials.email, password: credentials.password },
  })).ok()).toBeTruthy();
  const accountResponse = await page.request.post('/api/accounts', {
    data: { name: 'Loading stability account' },
  });
  expect(accountResponse.ok()).toBeTruthy();
  const account = await accountResponse.json();
  expect((await page.request.post('/api/trades', {
    data: {
      accountId: account._id, symbol: 'STABLE', direction: 'long',
      quantity: 1, entryPrice: 100, exitPrice: 101,
      entryTime: new Date().toISOString(), exitTime: new Date().toISOString(),
    },
  })).ok()).toBeTruthy();
  await page.goto('/trades');
  const row = page.getByRole('row', { name: /Open STABLE trade/ });
  await expect(row).toBeVisible();
  await row.evaluate((element) => { window.stableTradeRow = element; });

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let requests = 0;
  await page.route('**/api/trades?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('search') !== 'NO_MATCH') {
      return route.continue();
    }
    requests += 1;
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole('textbox', { name: 'Search trades' }).fill('NO_MATCH');
    await expect(page.getByRole('progressbar', { name: 'Updating results' })).toBeVisible();
    await expect(row).toBeVisible();
    expect(await row.evaluate((element) => element === window.stableTradeRow)).toBe(true);
    await expect(page.getByText('Loading trades…', { exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByText('No matching trades', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Updating results' })).toHaveCount(0);
  expect(requests).toBe(1);
});
