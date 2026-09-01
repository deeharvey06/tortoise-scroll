import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './ReportsPage';
import * as reportsApi from '../../services/reportsService';

vi.mock('../../services/reportsService', () => ({
  fetchReport: vi.fn(),
}));

vi.mock('../../services/strategyService', () => ({
  fetchStrategies: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../store/useFilterStore', () => ({
  useFilterParams: () => ({}),
}));

describe('ReportsPage', () => {
  beforeEach(() => {
    reportsApi.fetchReport.mockImplementation((category) => {
      if (category === 'performance') {
        return Promise.resolve({
          summary: {
            netPnL: 0,
            winRate: 0,
            expectancy: 0,
            profitFactor: 0,
            avgR: 0,
            maxDrawdown: 0,
            closedTrades: 0,
            openTrades: 0,
          },
        });
      }

      if (category === 'execution') {
        return Promise.resolve({
          sampleSize: 0,
          byHour: [],
          note: 'No trades in this range.',
        });
      }

      if (category === 'behavior') {
        return Promise.resolve({
          sampleSize: 0,
          note: 'No trades in this range.',
          mistakes: [],
          emotions: [],
          ruleViolations: { violations: 0, violationRate: null },
          streaks: {},
          tradesPerDay: [],
        });
      }

      if (category === 'market') {
        return Promise.resolve({
          sampleSize: 0,
          bySymbol: [],
          bySession: [],
          byHour: [],
          byDayOfWeek: [],
          byDirection: [],
          byStrategy: [],
          bySetup: [],
        });
      }

      return Promise.resolve({});
    });
  });

  it('renders performance, execution, and behavior tabs without crashing when report stats are missing', async () => {
    render(<ReportsPage />);

    await waitFor(() =>
      expect(screen.getByText('Reports')).toBeInTheDocument(),
    );

    expect(await screen.findByText('Net P&L')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Execution' }));
    expect(await screen.findByText('Sample size')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Behavior' }));
    expect(await screen.findByText('Plan violations')).toBeInTheDocument();
  });
});
