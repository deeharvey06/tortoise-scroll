import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  selectMuiOptionByLabel,
  selectMuiOptionInRow,
  uploadViaLabelButton,
} from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVALID_CSV = path.join(
  __dirname,
  '..',
  'fixtures',
  'invalid-trades.csv',
);
const VALID_CSV = path.join(__dirname, '..', 'fixtures', 'sample-trades.csv');

async function createAccount(request, name) {
  const response = await request.post('/api/accounts', { data: { name } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function mapFixture(page) {
  await page.getByRole('button', { name: 'Preview' }).click();
  await expect(page.getByText(/rows detected/)).toBeVisible();
  await selectMuiOptionInRow(page, 'Symbol', 'Ticker');
  await selectMuiOptionInRow(page, 'Direction', 'Side');
  await selectMuiOptionInRow(page, 'Quantity', 'Shares');
  await selectMuiOptionInRow(page, 'Entry price', 'In');
  await selectMuiOptionInRow(page, 'Exit price', 'Out');
  await selectMuiOptionInRow(page, 'Entry time', 'Opened');
  await selectMuiOptionInRow(page, 'Exit time', 'Closed');
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function importFile(page, filePath, accountName) {
  await uploadViaLabelButton(page, 'Choose file', filePath);
  await mapFixture(page);
  await selectMuiOptionByLabel(page, 'Import into account', accountName);
  await page.getByRole('button', { name: /^Import \d+ rows$/ }).click();
}

test('invalid CSV reports row-level errors in the import result', async ({
  page,
  request,
}) => {
  const account = await createAccount(
    request,
    `E2E Invalid Import ${Date.now()}`,
  );

  await page.goto('/import');
  await uploadViaLabelButton(page, 'Choose file', INVALID_CSV);
  await mapFixture(page);
  await selectMuiOptionByLabel(page, 'Import into account', account.name);
  await page.getByRole('button', { name: /^Import 2 rows$/ }).click();

  await expect(page.getByText(/^1 imported$/)).toBeVisible();
  await expect(page.getByText(/^1 errors$/)).toBeVisible();
  await expect(
    page.getByText(/Unrecognized or missing direction/),
  ).toBeVisible();
});

test('dashboard renders its primary content at a mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByTestId('kpi-net-p-l')).toBeVisible();
  await expect(page.getByTestId('chart-equity-curve')).toBeVisible();
});

const RESPONSIVE_VIEWPORTS = [
  { name: 'desktop workstation', width: 1920, height: 1080 },
  { name: 'large laptop', width: 1440, height: 900 },
  { name: 'small laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test(`application shell remains usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/trades');
    await expect(page.getByRole('heading', { name: 'Trades' })).toBeVisible();

    if (viewport.width < 900) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
      await page.getByRole('button', { name: 'Close navigation' }).click();
    } else {
      await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    }

    await expect(page.locator('#main-content')).toBeVisible();
  });
}

test('re-importing the same CSV reports duplicate rows', async ({
  page,
  request,
}) => {
  const account = await createAccount(
    request,
    `E2E Duplicate Import ${Date.now()}`,
  );

  await page.goto('/import');
  await importFile(page, VALID_CSV, account.name);
  await expect(page.getByText(/^2 imported$/)).toBeVisible();

  await page.getByRole('button', { name: 'Import another file' }).click();
  await importFile(page, VALID_CSV, account.name);

  await expect(page.getByText(/^0 imported$/)).toBeVisible();
  await expect(page.getByText(/^2 duplicates skipped$/)).toBeVisible();
});

test('Tortoise AI exposes chat state and deterministic research tools', async ({ page, request }) => {
  const statusResponse = await request.get('/api/ai/status');
  expect(statusResponse.ok()).toBeTruthy();
  const status = await statusResponse.json();

  await page.goto('/ai-partner');
  await expect(page.getByRole('heading', { name: 'Tortoise AI' })).toBeVisible();
  await expect(page.getByText(status.configured ? 'Configured' : 'Not configured', { exact: true })).toBeVisible();
  const prompt = page.getByPlaceholder(/Ask about your trading|Configure AI above/);
  if (status.configured) await expect(prompt).toBeEnabled();
  else await expect(prompt).toBeDisabled();

  await page.getByRole('tab', { name: 'Research tools' }).click();
  for (const name of ['Auto Trade Tagger', 'Session Review', 'Pre-Market Briefing', 'Risk Monitor', 'Performance Patterns']) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
});
