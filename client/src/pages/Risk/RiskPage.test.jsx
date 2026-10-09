import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RiskPage from './RiskPage';
import * as riskApi from '../../services/riskService';

vi.mock('../../services/riskService', () => ({
  fetchRiskDashboard: vi.fn(),
  saveRiskSettings: vi.fn(),
}));

vi.mock('../../store/useFilterStore', () => ({
  useFilterStore: () => ({ accountId: null }),
}));

describe('RiskPage', () => {
  beforeEach(() => {
    riskApi.fetchRiskDashboard.mockResolvedValue({
      warnings: ['Daily loss limit reached'],
      current: {
        dailyPnL: -500,
        weeklyPnL: -500,
        currentDrawdown: 500,
        maxDrawdown: 500,
        consecutiveLosses: 2,
        tradesToday: 4,
        openPositions: 1,
        currentExposure: 1000,
      },
      settings: {},
    });
  });

  it('lets users dismiss risk warnings for the current page session', async () => {
    render(<RiskPage />);

    expect(
      await screen.findByText('Daily loss limit reached')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() =>
      expect(
        screen.queryByText('Daily loss limit reached')
      ).not.toBeInTheDocument()
    );
  });
});
