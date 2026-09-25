import { fireEvent, render, screen } from '@/test/render';
import { beforeEach, expect, test, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '@/theme/theme';
import ReplayPage from '@/pages/Replay/TradeReviewPage';
import * as replayApi from '@/services/replayService';

vi.mock('@/services/replayService', () => ({
  fetchReplaySession: vi.fn(),
}));
vi.mock('@/services/tagService', () => ({
  fetchTags: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/tradeService', () => ({ updateTrade: vi.fn() }));
// Chart measurements are browser responsibilities, covered by Playwright.
vi.mock('recharts', async (original) => ({
  ...(await original()),
  ResponsiveContainer: () => null,
}));
beforeEach(() => vi.clearAllMocks());

for (const mode of ['dark', 'light']) {
  for (const configured of [false, true]) {
    test(`Replay retains fill-only disclosure in ${mode} with provider configured=${configured}`, async () => {
      replayApi.fetchReplaySession.mockResolvedValue({
        date: '2026-03-09',
        marketData: { configured },
        trades: [
          {
            _id: 'one',
            symbol: 'AAPL',
            direction: 'long',
            quantity: 1,
            entryTime: '2026-03-09T13:30:00Z',
            exitTime: '2026-03-09T13:32:00Z',
            entryPrice: 100,
            exitPrice: 101,
            netPnL: 1,
            rMultiple: 1,
            tags: [],
          },
        ],
      });
      render(
        <ThemeProvider theme={createTortoiseTheme(mode)}>
          <ReplayPage />
        </ThemeProvider>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Load session' }));
      expect(
        await screen.findByText(/chart below plots only your actual logged/)
      ).toBeVisible();
      expect(
        screen.getByText(/does not represent real price movement/)
      ).toBeVisible();
      expect(
        Boolean(screen.queryByText(/No market-data provider is connected/))
      ).toBe(!configured);
    });
  }
}

test('Replay preserves error and empty states', async () => {
  replayApi.fetchReplaySession
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ trades: [], marketData: { configured: true } });
  render(
    <ThemeProvider theme={createTortoiseTheme('dark')}>
      <ReplayPage />
    </ThemeProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Load session' }));
  expect(await screen.findByText('Unavailable')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Load session' }));
  expect(await screen.findByText('No trades in this session')).toBeVisible();
});
