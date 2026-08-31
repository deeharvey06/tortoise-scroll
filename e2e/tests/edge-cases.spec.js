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
