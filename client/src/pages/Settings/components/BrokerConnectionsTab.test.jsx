import { render, screen, waitFor } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import BrokerConnectionsTab from '@/pages/Settings/components/BrokerConnectionsTab';
import * as brokerApi from '@/services/brokerConnectionService';

vi.mock('@/services/brokerConnectionService', () => ({
  fetchProviders: vi.fn(),
  fetchConnections: vi.fn(),
  beginConnection: vi.fn(),
  fetchBrokerAccounts: vi.fn(),
  mapBrokerAccount: vi.fn(),
  syncNow: vi.fn(),
  fetchSyncHistory: vi.fn(),
  disconnect: vi.fn(),
}));

test('renders a connected broker and exposes sync results without credentials', async () => {
  brokerApi.fetchProviders.mockResolvedValue([
    {
      key: 'thinkorswim',
      label: 'Thinkorswim / Schwab',
      capabilities: { executions: true },
    },
  ]);
  brokerApi.fetchConnections.mockResolvedValue([
    {
      _id: 'c1',
      provider: 'thinkorswim',
      status: 'connected',
      accountMappings: [{ providerAccountId: 'b1', accountId: 'a1' }],
      providerMetadata: { discoveredAccounts: [] },
    },
  ]);
  brokerApi.syncNow.mockResolvedValue({
    summary: { executionsInserted: 2, duplicates: 1 },
  });
  brokerApi.fetchBrokerAccounts.mockResolvedValue([]);
  brokerApi.fetchSyncHistory.mockResolvedValue([]);

  render(
    <BrokerConnectionsTab accounts={[{ _id: 'a1', name: 'Main Futures' }]} />
  );
  expect(await screen.findByText('Thinkorswim / Schwab')).toBeInTheDocument();
  expect(
    screen.queryByText(/accessToken|refreshToken/i)
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sync Now' }));
  await waitFor(() => expect(brokerApi.syncNow).toHaveBeenCalledWith('c1'));
  expect(
    await screen.findByText(/2 new executions, 1 duplicates/)
  ).toBeInTheDocument();
});
