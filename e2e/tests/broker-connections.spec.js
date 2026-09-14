import { test, expect } from '@playwright/test';
import { authenticateAsDemo } from './helpers.js';

test('broker connections supports manage, sync history, and disconnect without exposing credentials', async ({ page, request }) => {
  await authenticateAsDemo(page, request);
  let disconnected = false;
  const connection = {
    _id: '68c0ffee0000000000000001',
    provider: 'thinkorswim',
    status: 'connected',
    lastSuccessfulSyncAt: '2026-09-10T16:42:00Z',
    accountMappings: [{ providerAccountId: 'broker-account-hash', accountId: '68c0ffee0000000000000002' }],
    providerMetadata: { discoveredAccounts: [{ providerAccountId: 'broker-account-hash', providerAccountNumberMasked: '…1234', providerAccountName: 'Main Futures' }] },
  };

  await page.route('**/api/broker-connections/providers', (route) => route.fulfill({ json: [{ key: 'thinkorswim', label: 'Thinkorswim / Schwab', capabilities: { executions: true, positions: true } }] }));
  await page.route('**/api/broker-connections', (route) => route.fulfill({ json: disconnected ? [{ ...connection, status: 'disconnected', accountMappings: [] }] : [connection] }));
  await page.route('**/api/broker-connections/*/accounts', (route) => route.fulfill({ json: connection.providerMetadata.discoveredAccounts }));
  await page.route('**/api/broker-connections/*/history', (route) => route.fulfill({ json: [{ _id: 'run1', startedAt: '2026-09-10T16:42:00Z', syncType: 'manual', status: 'completed', summary: { recordsFetched: 42, executionsInserted: 3, duplicates: 1, tradesReconstructed: 1, errors: 0 } }] }));
  await page.route('**/api/broker-connections/*/sync', (route) => route.fulfill({ json: { summary: { executionsInserted: 3, duplicates: 1 } } }));
  await page.route('**/api/broker-connections/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      disconnected = true;
      return route.fulfill({ json: { ...connection, status: 'disconnected' } });
    }
    return route.fallback();
  });

  await page.goto('/settings?brokerConnection=68c0ffee0000000000000001');
  await expect(page.getByText('Broker connections', { exact: true })).toBeVisible();
  await expect(page.getByText('Thinkorswim / Schwab', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/accessToken|refreshToken/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Manage' }).click();
  await expect(page.getByText('Main Futures')).toBeVisible();
  await expect(page.getByText(/42 checked/)).toBeVisible();

  await page.getByRole('button', { name: 'Sync Now' }).click();
  await expect(page.getByText(/Sync complete: 3 new executions, 1 duplicates/)).toBeVisible();

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).last().click();
  await expect(page.getByText(/Historical executions, trades, and journal data were preserved/)).toBeVisible();
});
