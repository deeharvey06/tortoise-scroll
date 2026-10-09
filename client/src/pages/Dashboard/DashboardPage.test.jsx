import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import { fetchDashboard } from '@/services/analyticsService';

vi.mock('@/services/analyticsService', () => ({ fetchDashboard: vi.fn() }));
vi.mock('@/store/useFilterStore', () => ({ useFilterParams: () => ({}) }));

beforeEach(() => vi.clearAllMocks());

it('shows an actionable empty state', async () => {
  fetchDashboard.mockResolvedValue({
    summary: { totalTrades: 0, closedTrades: 0 },
  });
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
  expect(
    await screen.findByText('No trades match the current view')
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open trades' })).toHaveAttribute(
    'href',
    '/trades'
  );
});

it('renders each dashboard section when only open trades exist', async () => {
  fetchDashboard.mockResolvedValue({
    summary: {
      totalTrades: 1,
      closedTrades: 0,
      openTrades: 1,
      winningTrades: 0,
      avgR: null,
    },
    dailyStats: [],
    bySetup: [],
    bySymbol: [],
    byDayOfWeek: [],
    byHour: [],
  });
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
  expect(
    await screen.findByRole('heading', { name: 'Performance overview' })
  ).toBeVisible();
  for (const name of [
    'Equity and drawdown',
    'Sample and outcome evidence',
    'Consistency and distribution',
    'What is working',
    'Timing evidence',
  ]) {
    expect(screen.getByRole('region', { name })).toBeVisible();
  }
  expect(
    screen.getByRole('link', { name: 'Review process evidence' })
  ).toHaveAttribute('href', '/reports');
});
