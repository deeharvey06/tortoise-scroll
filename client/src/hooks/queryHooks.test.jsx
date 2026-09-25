import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@/test/render';
import useDashboard from '@/hooks/useDashboard';
import useReport from '@/pages/Reports/hooks/useReport';
import useContextAnalytics from '@/pages/Knowledge/hooks/useContextAnalytics';
import { fetchDashboard } from '@/services/analyticsService';
import { fetchReport } from '@/services/reportsService';
import { fetchStrategies } from '@/services/strategyService';
import { compareContext } from '@/services/contextAnalyticsService';

vi.mock('@/services/analyticsService', () => ({ fetchDashboard: vi.fn() }));
vi.mock('@/services/reportsService', () => ({ fetchReport: vi.fn() }));
vi.mock('@/services/strategyService', () => ({ fetchStrategies: vi.fn() }));
vi.mock('@/services/contextAnalyticsService', () => ({
  compareContext: vi.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('query lifecycle', () => {
  it('keeps loaded dashboard content visible while changed filters are pending', async () => {
    const next = deferred();
    fetchDashboard.mockReset().mockResolvedValueOnce({ account: 'a' });
    const { result, rerender } = renderHook((params) => useDashboard(params), {
      initialProps: { accountId: 'a' },
    });
    await waitFor(() => expect(result.current.data).toEqual({ account: 'a' }));
    fetchDashboard.mockReturnValue(next.promise);
    rerender({ accountId: 'b' });
    expect(result.current.data).toEqual({ account: 'a' });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => next.resolve({ account: 'b' }));
    await waitFor(() => expect(result.current.data).toEqual({ account: 'b' }));
    expect(result.current.refreshing).toBe(false);
  });

  it('retains a report on filter refresh but never across report categories', async () => {
    const next = deferred();
    fetchReport
      .mockReset()
      .mockResolvedValueOnce({ summary: { totalTrades: 2 } });
    const { result, rerender } = renderHook(
      ({ category, filters }) => useReport(category, filters),
      { initialProps: { category: 'performance', filters: {} } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchReport.mockReturnValue(next.promise);
    rerender({ category: 'performance', filters: { symbol: 'ES' } });
    expect(result.current.data).toEqual({ summary: { totalTrades: 2 } });
    expect(result.current.refreshing).toBe(true);
    rerender({ category: 'execution', filters: { symbol: 'ES' } });
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await act(async () => next.resolve({ execution: [] }));
  });

  it('keeps the current account result when an older request finishes last', async () => {
    const old = deferred();
    fetchDashboard.mockImplementation(({ accountId }) =>
      accountId === 'a' ? old.promise : Promise.resolve({ account: 'b' })
    );
    const { result, rerender } = renderHook((params) => useDashboard(params), {
      initialProps: { accountId: 'a' },
    });
    rerender({ accountId: 'b' });
    await waitFor(() => expect(result.current.data).toEqual({ account: 'b' }));
    await act(async () => old.resolve({ account: 'a' }));
    expect(result.current.data).toEqual({ account: 'b' });
  });

  it('loads in StrictMode and does not refetch for equivalent filter objects', async () => {
    fetchDashboard.mockReset().mockResolvedValue({ summary: {} });
    const { result, rerender } = renderHook((params) => useDashboard(params), {
      initialProps: { symbol: 'ES', accountId: 'a' },
      wrapper: StrictMode,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const count = fetchDashboard.mock.calls.length;
    rerender({ accountId: 'a', symbol: 'ES' });
    expect(result.current.data).toEqual({ summary: {} });
    expect(fetchDashboard).toHaveBeenCalledTimes(count);
  });

  it('shows a failed report instead of previous-category data', async () => {
    fetchReport.mockImplementation((category) =>
      category === 'performance'
        ? Promise.resolve({ summary: {} })
        : Promise.reject(new Error('Report unavailable'))
    );
    const { result, rerender } = renderHook(
      (category) => useReport(category, {}),
      { initialProps: 'performance' }
    );
    await waitFor(() => expect(result.current.data).toEqual({ summary: {} }));
    rerender('execution');
    await waitFor(() =>
      expect(result.current.error).toBe('Report unavailable')
    );
    expect(result.current.data).toBeUndefined();
  });

  it('resolves strategy names without mutating the report', async () => {
    const report = { byStrategy: [{ key: 'known' }, { key: 'deleted' }] };
    fetchReport.mockResolvedValue(report);
    fetchStrategies.mockResolvedValue([{ _id: 'known', name: 'Pullback' }]);
    const { result } = renderHook(() => useReport('market', {}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.byStrategy.map((row) => row.label)).toEqual([
      'Pullback',
      'Unresolved strategy',
    ]);
    expect(report.byStrategy[0]).not.toHaveProperty('label');
  });

  it('only compares on submit and hides late results for changed filters', async () => {
    const old = deferred();
    compareContext.mockReturnValue(old.promise);
    const { result, rerender } = renderHook(
      (filters) => useContextAnalytics([], filters),
      { initialProps: { accountId: 'a' } }
    );
    expect(compareContext).not.toHaveBeenCalled();
    act(() => result.current.load());
    await waitFor(() => expect(compareContext).toHaveBeenCalledTimes(1));
    rerender({ accountId: 'b' });
    await act(async () => old.resolve({ sampleSize: 10, groups: [] }));
    expect(result.current.data).toBeNull();
    expect(result.current.busy).toBe(false);
  });
});
