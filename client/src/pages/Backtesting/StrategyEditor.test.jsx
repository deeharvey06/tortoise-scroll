import { fireEvent, render, screen, waitFor } from '@/test/render';
import { ThemeProvider } from '@mui/material/styles';
import { beforeEach, expect, test, vi } from 'vitest';
import { createTortoiseTheme } from '@/theme/theme';
import StrategyEditor, {
  initialStrategy,
  initialExecution,
} from '@/pages/Backtesting/StrategyEditor';
import ResultDetails from '@/pages/Backtesting/ResultDetails';
import api from '@/services/api';
import * as backtestApi from '@/services/backtestService';
vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('@/services/backtestService', () => ({
  createConfig: vi.fn(),
  updateConfig: vi.fn(),
}));
const config = {
  _id: 'config',
  name: 'My test',
  datasetId: 'fixture',
  symbol: 'AAPL',
  timeframe: '1m',
  dateFrom: '2026-03-09T13:30:00Z',
  dateTo: '2026-03-09T14:30:00Z',
  strategyDefinition: initialStrategy,
  execution: { ...initialExecution, accepted: true },
};
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({
    data: {
      datasets: [
        {
          id: 'fixture',
          symbol: 'AAPL',
          timeframe: '1m',
          calendar: { from: config.dateFrom, to: config.dateTo },
        },
      ],
    },
  });
});
function show(mode = 'light', onSaved = vi.fn()) {
  return render(
    <ThemeProvider theme={createTortoiseTheme(mode)}>
      <StrategyEditor config={config} onClose={vi.fn()} onSaved={onSaved} />
    </ThemeProvider>
  );
}
for (const mode of ['light', 'dark'])
  test(`strategy editor exposes assumptions and requires acceptance in ${mode}`, async () => {
    show(mode);
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/market-data/datasets')
    );
    expect(
      screen.getByRole('button', { name: 'Save strategy' })
    ).toBeDisabled();
    expect(screen.getByLabelText('Intrabar path')).toBeInTheDocument();
    expect(screen.getByLabelText('Adverse slippage (ticks)')).toHaveValue(0);
    expect(screen.getByText(/OHLC bars do not reveal/)).toBeInTheDocument();
  });
test('saving preserves versioned rules and selected policies without writing simulated trades', async () => {
  const saved = vi.fn();
  show('light', saved);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  fireEvent.click(
    screen.getByLabelText('I accept these execution assumptions and costs')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save strategy' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(backtestApi.updateConfig).toHaveBeenCalledWith(
    'config',
    expect.objectContaining({
      engineVersion: 2,
      strategyDefinition: initialStrategy,
      execution: { ...initialExecution, accepted: true },
    })
  );
});
test('cost changes revoke acceptance and provider errors are visible', async () => {
  api.get.mockRejectedValue(new Error('Catalog unavailable'));
  show();
  await screen.findByText('Catalog unavailable');
  fireEvent.click(
    screen.getByLabelText('I accept these execution assumptions and costs')
  );
  fireEvent.change(screen.getByLabelText('Adverse slippage (ticks)'), {
    target: { value: '2' },
  });
  expect(screen.getByRole('button', { name: 'Save strategy' })).toBeDisabled();
});
test('results disclose empty closed-trade statistics, open risk and archived legacy behavior', () => {
  render(
    <ResultDetails
      result={{
        trades: [],
        summary: {},
        openPosition: { quantity: 1, entryPrice: 100, unrealizedPnL: -2 },
        pendingOrder: { type: 'stop' },
      }}
    />
  );
  expect(screen.getByText(/Archived proof-of-concept/)).toBeInTheDocument();
  expect(screen.getByText(/No closed trades/)).toBeInTheDocument();
  expect(
    screen.getByText(/Excluded from realized trade statistics/)
  ).toBeInTheDocument();
});
