import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { beforeEach, expect, test, vi } from 'vitest';
import { createTortoiseTheme } from '../../theme/theme';
import ReplayWorkspace from './ReplayWorkspace';
import CandlestickChart from './components/CandlestickChart';
import * as api from '../../services/replayService';
vi.mock('../../services/replayService', () => ({
  fetchReplayDatasets: vi.fn(),
  listReplayRuns: vi.fn(),
  createReplayRun: vi.fn(),
  getReplayRun: vi.fn(),
  controlReplay: vi.fn(),
  addReplayEvent: vi.fn(),
  removeReplayEvent: vi.fn(),
  saveReplayScreenshot: vi.fn(),
}));
const bar = {
  timestamp: '2026-03-09T13:30:00.000Z',
  endTimestamp: '2026-03-09T13:31:00.000Z',
  open: 100,
  high: 102,
  low: 99,
  close: 101,
  volume: 10,
};
const state = (changes = {}) => ({
  id: 'run',
  name: 'Training',
  mode: 'blind',
  version: 0,
  cursor: -1,
  maxCursor: -1,
  barCount: 3,
  complete: false,
  revealed: false,
  timestamp: bar.timestamp,
  marketRequest: {
    symbol: 'AAPL',
    timeframe: '1m',
    from: bar.timestamp,
    to: '2026-03-09T13:33:00Z',
  },
  dataset: { timezone: 'America/New_York' },
  candles: [],
  markers: [],
  comparison: null,
  events: [],
  screenshots: [],
  indicators: {
    series: [],
    sessionHigh: null,
    sessionLow: null,
    vwapUnavailable: true,
  },
  ...changes,
});
function renderPage(mode = 'dark') {
  return render(
    <StrictMode>
      <ThemeProvider theme={createTortoiseTheme(mode)}>
        <ReplayWorkspace />
      </ThemeProvider>
    </StrictMode>
  );
}
async function resume() {
  fireEvent.mouseDown(await screen.findByLabelText('Resume saved replay'));
  fireEvent.click(
    await screen.findByRole('option', { name: 'Training · blind' })
  );
  await screen.findByText(/Original trades and results are hidden/);
}
beforeEach(() => {
  vi.clearAllMocks();
  api.fetchReplayDatasets.mockResolvedValue([]);
  api.listReplayRuns.mockResolvedValue([
    { _id: 'run', name: 'Training', mode: 'blind' },
  ]);
  api.getReplayRun.mockResolvedValue(state());
});

for (const mode of ['light', 'dark']) {
  test(`blind workspace renders accessible controls and candle disclosure in ${mode}`, async () => {
    renderPage(mode);
    await resume();
    expect(
      screen.getByRole('img', { name: 'Revealed market candles' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Step one bar' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Reveal original trades' })
    ).toBeDisabled();
    expect(
      screen.getByRole('slider', { name: 'Replay timeline' })
    ).toBeDisabled();
    expect(screen.queryAllByTestId('replay-candle')).toHaveLength(0);
    expect(screen.queryByText('Historical comparison')).not.toBeInTheDocument();
  });
}

test('stepping consumes only server projections and changes current timestamp', async () => {
  api.controlReplay.mockResolvedValue(
    state({
      cursor: 0,
      maxCursor: 0,
      version: 1,
      timestamp: bar.endTimestamp,
      candles: [bar],
      indicators: {
        series: [{ timestamp: bar.timestamp, ema: 101, vwap: 100.666 }],
        sessionHigh: 102,
        sessionLow: 99,
      },
    })
  );
  renderPage();
  await resume();
  fireEvent.click(screen.getByRole('button', { name: 'Step one bar' }));
  await waitFor(() =>
    expect(screen.getAllByTestId('replay-candle')).toHaveLength(1)
  );
  expect(api.controlReplay).toHaveBeenCalledWith('run', {
    action: 'step',
    count: 1,
    version: 0,
  });
  expect(screen.getByText(/2026-03-09T13:31:00.000Z/)).toBeVisible();
});

test('decisions send action/confidence/reasoning/version but never client replay timestamps', async () => {
  api.addReplayEvent.mockResolvedValue(
    state({
      version: 1,
      events: [
        {
          _id: 'decision',
          kind: 'decision',
          action: 'Wait',
          confidence: 3,
          text: 'Wait for a closed bar',
          timestamp: bar.timestamp,
          cursor: -1,
        },
      ],
    })
  );
  renderPage();
  await resume();
  fireEvent.change(screen.getByLabelText('Reasoning'), {
    target: { value: 'Wait for a closed bar' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
  expect(
    await screen.findByText(
      'Saved to this replay. Historical trades were not changed.'
    )
  ).toBeVisible();
  expect(api.addReplayEvent).toHaveBeenCalledWith('run', {
    kind: 'decision',
    action: 'Wait',
    confidence: 3,
    text: 'Wait for a closed bar',
    version: 0,
  });
});

test('source errors are visible and existing decisions are not replaced with fabricated candles', async () => {
  api.controlReplay.mockRejectedValue(new Error('Historical data changed'));
  renderPage();
  await resume();
  fireEvent.click(screen.getByRole('button', { name: 'Step one bar' }));
  expect(await screen.findByText('Historical data changed')).toBeVisible();
  expect(screen.queryAllByTestId('replay-candle')).toHaveLength(0);
});

test('empty catalog and unavailable provider have honest states', async () => {
  api.fetchReplayDatasets.mockRejectedValue(new Error('No supported provider'));
  renderPage();
  expect(
    await screen.findByText('No historical datasets available')
  ).toBeVisible();
  expect(screen.getByText('No supported provider')).toBeVisible();
});

test('chart contains only supplied as-of prices, markers and indicators, including screenshot SVG', () => {
  const view = state({
    cursor: 0,
    candles: [bar],
    indicators: {
      series: [{ timestamp: bar.timestamp, ema: 101, vwap: null }],
    },
    markers: [
      {
        tradeId: 'one',
        timestamp: bar.timestamp,
        price: 100,
        quantity: 1,
        side: 'buy',
        kind: 'entry',
      },
    ],
  });
  const { container } = render(
    <ThemeProvider theme={createTortoiseTheme('dark')}>
      <CandlestickChart view={view} showEMA showVWAP showHistory />
    </ThemeProvider>
  );
  expect(screen.getAllByTestId('replay-candle')).toHaveLength(1);
  expect(screen.getAllByTestId('replay-marker')).toHaveLength(1);
  expect(container.textContent).not.toContain('999999');
  expect(container.innerHTML).not.toContain('13:32');
});
