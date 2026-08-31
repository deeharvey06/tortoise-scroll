import { create } from 'zustand';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns';

export const DATE_PRESETS = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'previousMonth',
  'quarter',
  'year',
  'allTime',
  'custom',
];

export function resolveDateRange(preset, customFrom, customTo) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { dateFrom: startOfDay(now), dateTo: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { dateFrom: startOfDay(y), dateTo: endOfDay(y) };
    }
    case 'thisWeek':
      return { dateFrom: startOfWeek(now), dateTo: endOfWeek(now) };
    case 'thisMonth':
      return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) };
    case 'previousMonth': {
      const prev = subMonths(now, 1);
      return { dateFrom: startOfMonth(prev), dateTo: endOfMonth(prev) };
    }
    case 'quarter':
      return { dateFrom: startOfQuarter(now), dateTo: endOfQuarter(now) };
    case 'year':
      return { dateFrom: startOfYear(now), dateTo: endOfYear(now) };
    case 'custom':
      return { dateFrom: customFrom || null, dateTo: customTo || null };
    case 'allTime':
    default:
      return { dateFrom: null, dateTo: null };
  }
}

export const useFilterStore = create((set) => ({
  datePreset: 'allTime',
  customFrom: null,
  customTo: null,
  accountId: '',
  symbol: '',
  strategy: '',
  setup: '',
  direction: '',
  session: '',
  tags: [],

  setDatePreset: (datePreset) => set({ datePreset }),
  setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, datePreset: 'custom' }),
  setAccountId: (accountId) => set({ accountId }),
  setSymbol: (symbol) => set({ symbol }),
  setStrategy: (strategy) => set({ strategy }),
  setSetup: (setup) => set({ setup }),
  setDirection: (direction) => set({ direction }),
  setSession: (session) => set({ session }),
  setTags: (tags) => set({ tags }),
  reset: () =>
    set({
      datePreset: 'allTime',
      customFrom: null,
      customTo: null,
      accountId: '',
      symbol: '',
      strategy: '',
      setup: '',
      direction: '',
      session: '',
      tags: [],
    }),
}));

/** Converts current filter store state into the query params the API expects. */
export function useFilterParams() {
  const state = useFilterStore();
  const { dateFrom, dateTo } = resolveDateRange(state.datePreset, state.customFrom, state.customTo);
  const params = {};
  if (state.accountId) params.accountId = state.accountId;
  if (state.symbol) params.symbol = state.symbol;
  if (state.strategy) params.strategy = state.strategy;
  if (state.setup) params.setup = state.setup;
  if (state.direction) params.direction = state.direction;
  if (state.session) params.session = state.session;
  if (state.tags?.length) params.tags = state.tags;
  if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
  if (dateTo) params.dateTo = new Date(dateTo).toISOString();
  return params;
}

export default useFilterStore;
