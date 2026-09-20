import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createTortoiseTheme } from '../../theme/theme';
import api from '../../services/api';
import { KnowledgeCards, KnowledgePicker, allApproved } from './shared';
import ContextAnalytics from './ContextAnalytics';
import PreparationEditor from './PreparationEditor';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { items: [], total: 0 } });
});

for (const mode of ['dark', 'light'])
  test(`knowledge preserves probability qualifications and provenance in ${mode}`, () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTortoiseTheme(mode)}>
          <KnowledgeCards
            items={[
              {
                _id: 'one',
                name: 'Conditional observation',
                kind: 'probability',
                status: 'approved',
                interpretation: 'Source-qualified statement',
                probability: {
                  value: 60,
                  event: 'Example outcome',
                  conditions: 'Only when A',
                  qualifications: 'Except B',
                  timeframe: 'Five bars',
                },
                references: [
                  {
                    sourceId: 'source',
                    sectionId: 'page-2',
                    page: 2,
                    sourceType: 'PERSONAL_NOTES',
                    heading: 'Context',
                  },
                ],
              },
            ]}
          />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('conditions: Only when A')).toBeVisible();
    expect(screen.getByText('qualifications: Except B')).toBeVisible();
    expect(screen.getByText('timeframe: Five bars')).toBeVisible();
    expect(
      screen.getByRole('link', { name: /PERSONAL_NOTES/ })
    ).toHaveAttribute('href', '/knowledge?source=source&section=page-2');
  });

test('approved catalog loads all pages and never requests unreviewed items', async () => {
  api.get
    .mockResolvedValueOnce({ data: { items: [{ _id: 'a' }], total: 2 } })
    .mockResolvedValueOnce({ data: { items: [{ _id: 'b' }], total: 2 } });

  expect((await allApproved()).map((i) => i._id)).toEqual(['a', 'b']);
  expect(api.get).toHaveBeenNthCalledWith(2, '/knowledge/items', {
    params: { status: 'approved', page: 2 },
  });
});

test('empty approved picker explains the review requirement', async () => {
  render(<KnowledgePicker value={[]} onChange={() => {}} />);
  expect(
    await screen.findByText(/Approve source-backed knowledge/)
  ).toBeVisible();
});

test('context analytics keeps existing filters, sample counts, currency and R coverage', async () => {
  api.post.mockResolvedValue({
    data: {
      sampleSize: 2,
      groups: [
        {
          currency: 'USD',
          sampleSize: 2,
          winningTrades: 1,
          losingTrades: 1,
          openTrades: 0,
          netPnL: 10,
          winRate: 50,
          profitFactor: 2,
          totalR: 1,
          avgR: 0.5,
          rSampleSize: 2,
          expectancy: 5,
          maxDrawdown: -10,
          interpretation: 'Observed personal sample',
        },
      ],
    },
  });

  render(
    <ContextAnalytics
      initialIds={['a', 'b']}
      filters={{ accountId: 'account', dateFrom: '2026-01-01T00:00:00Z' }}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Compare my trades' }));

  expect(await screen.findByText('Closed-trade sample: 2')).toBeVisible();
  expect(screen.getByText('USD · 2 closed trades')).toBeVisible();
  expect(screen.getByText(/R sample 2/)).toBeVisible();
  expect(api.post).toHaveBeenCalledWith(
    '/knowledge/analytics',
    expect.objectContaining({
      knowledgeIds: ['a', 'b'],
      accountId: 'account',
      dateFrom: '2026-01-01T00:00:00Z',
    })
  );
});

test('analytics error is explicit and old results clear when account filters change', async () => {
  api.post.mockRejectedValue(new Error('Unavailable'));
  const { rerender } = render(
    <ContextAnalytics filters={{ accountId: 'a' }} />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Compare my trades' }));

  expect(await screen.findByText('Unavailable')).toBeVisible();
  rerender(<ContextAnalytics filters={{ accountId: 'b' }} />);
  await waitFor(() =>
    expect(screen.queryByText(/Closed-trade sample/)).not.toBeInTheDocument()
  );
});

test('pre-market scenario editor preserves freeform context and adds explicit scenario fields', () => {
  const change = vi.fn();
  render(
    <PreparationEditor
      value={{
        priorDay: 'Existing preparation',
        knowledgeIds: [],
        levels: [],
        scenarios: [],
      }}
      onChange={change}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: 'Add scenario' }));

  expect(change).toHaveBeenCalledWith(
    expect.objectContaining({
      priorDay: 'Existing preparation',
      scenarios: [
        expect.objectContaining({
          condition: '',
          context: '',
          lookFor: '',
          avoid: '',
          invalidatedBy: '',
        }),
      ],
    })
  );
});
