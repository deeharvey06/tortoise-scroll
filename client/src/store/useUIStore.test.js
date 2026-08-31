import { afterEach, describe, expect, it } from 'vitest';
import useUIStore, { SIDEBAR_STORAGE_KEY, THEME_STORAGE_KEY } from './useUIStore';

describe('theme preference', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(SIDEBAR_STORAGE_KEY);
    useUIStore.getState().setThemeMode('system');
    useUIStore.getState().setSidebarCollapsed(false);
  });

  it('persists a valid theme preference', () => {
    useUIStore.getState().setThemeMode('light');
    expect(useUIStore.getState().themeMode).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('ignores unsupported theme preferences', () => {
    const current = useUIStore.getState().themeMode;
    useUIStore.getState().setThemeMode('sepia');
    expect(useUIStore.getState().themeMode).toBe(current);
  });

  it('persists sidebar collapse state', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
  });
});
