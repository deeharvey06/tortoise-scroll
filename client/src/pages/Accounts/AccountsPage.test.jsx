import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '../../theme/theme';
import AccountsPage from './AccountsPage';
import * as accountApi from '../../services/accountService';
import * as instrumentApi from '../../services/instrumentSpecificationService';

vi.mock('../../services/accountService', () => ({
  fetchAccounts: vi.fn(),
  fetchAccountPerformance: vi.fn(),
  fetchAccountImportHistory: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  archiveAccount: vi.fn(),
  restoreAccount: vi.fn(),
  setDefaultAccount: vi.fn(),
}));
vi.mock('../../services/instrumentSpecificationService', () => ({
  fetchInstrumentSpecifications: vi.fn(),
  createInstrumentSpecification: vi.fn(),
  updateInstrumentSpecification: vi.fn(),
  deleteInstrumentSpecification: vi.fn(),
}));

function renderAccountsPage(mode = 'dark') {
  return render(
    <ThemeProvider theme={createTortoiseTheme(mode)}>
      <AccountsPage />
    </ThemeProvider>
  );
}

beforeEach(() => {
  accountApi.fetchAccounts.mockResolvedValue([
    {
      _id: 'a1',
      name: 'Main Futures',
      broker: 'Schwab',
      accountType: 'futures',
      currency: 'USD',
      startingBalance: 50000,
      isActive: true,
      isDefault: true,
      tradingConfig: { defaultInstrumentSymbol: 'ES' },
    },
  ]);
  instrumentApi.fetchInstrumentSpecifications.mockResolvedValue({
    custom: [],
    builtins: [
      {
        symbol: 'ES',
        assetType: 'future',
        tickSize: 0.25,
        tickValue: 12.5,
        pointValue: 50,
        contractMultiplier: 50,
        currency: 'USD',
        exchange: 'CME',
        timezone: 'America/Chicago',
      },
      {
        symbol: 'MES',
        assetType: 'future',
        tickSize: 0.25,
        tickValue: 1.25,
        pointValue: 5,
        contractMultiplier: 5,
        currency: 'USD',
        exchange: 'CME',
        timezone: 'America/Chicago',
      },
    ],
  });
  accountApi.fetchAccountPerformance.mockResolvedValue({
    tradeCount: 10,
    netPnL: 500,
    winRate: 60,
    totalR: 8,
    currentBalance: 50500,
  });
  accountApi.fetchAccountImportHistory.mockResolvedValue([]);
});

test('renders owned account configuration and centralized built-in instrument specifications', async () => {
  renderAccountsPage();
  expect(await screen.findByText('Main Futures')).toBeInTheDocument();
  expect(screen.getByText('Schwab')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('tab', { name: 'Instrument specifications' })
  );
  expect(
    await screen.findByText('Built-in futures specifications')
  ).toBeInTheDocument();
  expect(screen.getByText('ES')).toBeInTheDocument();
  expect(screen.getByText('MES')).toBeInTheDocument();
  expect(screen.getByText('$12.50')).toBeInTheDocument();
});

test('sets an active account as default through the account service', async () => {
  accountApi.fetchAccounts
    .mockResolvedValueOnce([
      {
        _id: 'a1',
        name: 'Secondary',
        broker: 'Schwab',
        accountType: 'futures',
        currency: 'USD',
        startingBalance: 10000,
        isActive: true,
        isDefault: false,
      },
    ])
    .mockResolvedValueOnce([
      {
        _id: 'a1',
        name: 'Secondary',
        broker: 'Schwab',
        accountType: 'futures',
        currency: 'USD',
        startingBalance: 10000,
        isActive: true,
        isDefault: true,
      },
    ]);
  accountApi.setDefaultAccount.mockResolvedValue({
    ok: true,
    defaultAccountId: 'a1',
  });
  renderAccountsPage();
  const button = await screen.findByRole('button', {
    name: 'Make Secondary default',
  });
  await userEvent.click(button);
  await waitFor(() =>
    expect(accountApi.setDefaultAccount).toHaveBeenCalledWith('a1')
  );
  expect(
    await screen.findByText('Default account updated')
  ).toBeInTheDocument();
});

test.each(['dark', 'light'])(
  'renders the Accounts workspace with the %s Tortoise Scroll theme',
  async (mode) => {
    renderAccountsPage(mode);
    expect(await screen.findByText('Main Futures')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Accounts & Instruments/i })
    ).toBeInTheDocument();
  }
);
