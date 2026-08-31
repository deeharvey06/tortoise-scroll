import { create } from 'zustand';

// Global UI-only state (never server data — that's always fetched fresh
// or via a query cache, not duplicated into this store).
export const useUIStore = create((set) => ({
  snackbar: null, // { message, severity }
  showSnackbar: (message, severity = 'info') => set({ snackbar: { message, severity } }),
  clearSnackbar: () => set({ snackbar: null }),
}));

export default useUIStore;
