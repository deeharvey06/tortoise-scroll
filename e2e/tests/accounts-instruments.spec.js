import { test, expect } from '@playwright/test';
import { authenticateAsDemo, selectMuiOptionByLabel } from './helpers.js';

test('user manages an account and custom instrument specification without crossing ownership boundaries', async ({
  page,
  request,
}) => {
  await authenticateAsDemo(page, request);
  await page.goto('/accounts');

  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Account name').fill('E2E Futures');
  await page.getByLabel('Broker').fill('Schwab');
  await selectMuiOptionByLabel(page, 'Account type', 'futures');
  await page.getByLabel('Starting balance').fill('25000');
  await page.getByLabel('Default instrument').fill('ES');
  await page.getByRole('button', { name: 'Save account' }).click();

  await expect(page.getByText('E2E Futures')).toBeVisible();
  await page.getByRole('button', { name: 'Make E2E Futures default' }).click();
  await expect(page.getByText('Default account updated')).toBeVisible();

  await page.getByRole('tab', { name: 'Instrument specifications' }).click();
  await expect(page.getByText('Built-in futures specifications')).toBeVisible();
  await expect(page.getByText('ES', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add custom spec' }).click();
  await page.getByLabel('Symbol').fill('ZZTEST');
  await selectMuiOptionByLabel(page, 'Asset type', 'future');
  await page.getByLabel('Contract multiplier').fill('10');
  await page.getByLabel('Tick size').fill('0.25');
  await page.getByLabel('Tick value').fill('2.5');
  await page.getByLabel('Point value').fill('10');
  await page.getByLabel('Exchange').fill('TEST');
  await page.getByRole('button', { name: 'Save specification' }).click();
  await expect(page.getByText('Instrument specification saved')).toBeVisible();
  await expect(page.getByText('ZZTEST')).toBeVisible();

  const foreignAccountId = '64b000000000000000000001';
  const foreignRead = await page.request.get(
    `/api/accounts/${foreignAccountId}`,
  );
  expect([404, 400]).toContain(foreignRead.status());
});
