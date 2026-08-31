import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useFilterStore, { resolveDateRange, useFilterParams } from './useFilterStore';

describe('resolveDateRange', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves all-time to an unbounded range', () => {
    expect(resolveDateRange('allTime')).toEqual({ dateFrom: null, dateTo: null });
  });

  it('resolves a custom range without changing the supplied values', () => {
    expect(resolveDateRange('custom', '2026-08-01', '2026-08-20')).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-20',
    });
  });

  it('resolves today using the current local day boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T15:45:00'));

    const range = resolveDateRange('today');

    expect(range.dateFrom.getHours()).toBe(0);
    expect(range.dateFrom.getMinutes()).toBe(0);
    expect(range.dateTo.getHours()).toBe(23);
    expect(range.dateTo.getMinutes()).toBe(59);
  });
});

describe('useFilterParams', () => {
  afterEach(() => {
    act(() => useFilterStore.getState().reset());
  });

  it('maps active filters to API parameters and omits empty filters', () => {
    const { result } = renderHook(() => useFilterParams());

    act(() => {
      useFilterStore.getState().setAccountId('account-1');
      useFilterStore.getState().setSymbol('AAPL');
      useFilterStore.getState().setDirection('long');
      useFilterStore.getState().setTags(['breakout']);
    });

    expect(result.current).toEqual({
      accountId: 'account-1',
      symbol: 'AAPL',
      direction: 'long',
      tags: ['breakout'],
    });
  });
});