import { create } from 'zustand';

export const THEME_MODES = ['system', 'light', 'dark'];
export const THEME_STORAGE_KEY = 'tortoise-scroll-theme';
export const SIDEBAR_STORAGE_KEY = 'tortoise-scroll-sidebar-collapsed';

function readThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Global UI-only state (never server data — that's always fetched fresh
// or via a query cache, not duplicated into this store).
export const useUIStore = create((set) => ({
  themeMode: readThemeMode(),
  setThemeMode: (themeMode) => {
    if (!THEME_MODES.includes(themeMode)) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme switching remains available if persistent storage is blocked.
    }
    set({ themeMode });
  },
  sidebarCollapsed: readSidebarCollapsed(),
  setSidebarCollapsed: (sidebarCollapsed) => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
    set({ sidebarCollapsed });
  },
  toggleSidebar: () => set((state) => {
    const sidebarCollapsed = !state.sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // The in-memory preference still works when storage is unavailable.
    }
    return { sidebarCollapsed };
  }),
  mobileNavigationOpen: false,
  openMobileNavigation: () => set({ mobileNavigationOpen: true }),
  closeMobileNavigation: () => set({ mobileNavigationOpen: false }),
  snackbar: null, // { message, severity }
  showSnackbar: (message, severity = 'info') => set({ snackbar: { message, severity } }),
  clearSnackbar: () => set({ snackbar: null }),
}));

export default useUIStore;
