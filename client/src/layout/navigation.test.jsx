import { describe, expect, it } from 'vitest';
import { NAVIGATION_GROUPS, getRouteTitle } from '@/layout/navigation';

describe('application navigation', () => {
  it('contains only the existing grouped routes', () => {
    expect(NAVIGATION_GROUPS.map((group) => group.label)).toEqual([
      'Overview',
      'Trading',
      'Edge',
      'Tools',
      'Intelligence',
      'System',
    ]);
    expect(
      NAVIGATION_GROUPS.flatMap((group) => group.items.map((item) => item.to))
    ).toEqual([
      '/',
      '/trades',
      '/accounts',
      '/calendar',
      '/journal',
      '/knowledge',
      '/strategies',
      '/playbooks',
      '/reports',
      '/analytics',
      '/replay',
      '/backtesting',
      '/risk',
      '/ai-partner',
      '/import',
      '/settings',
      '/security',
      '/administration',
    ]);
  });

  it('restricts Methodology navigation to ROOT', () => {
    const item = NAVIGATION_GROUPS.flatMap((group) => group.items).find(
      (item) => item.to === '/knowledge'
    );
    expect(item.roles).toEqual(['ROOT']);
  });

  it('provides workspace titles for index and detail routes', () => {
    expect(getRouteTitle('/')).toBe('Dashboard');
    expect(getRouteTitle('/trades/123')).toBe('Trade Detail');
    expect(getRouteTitle('/accounts')).toBe('Accounts & Instruments');
    expect(getRouteTitle('/ai-partner')).toBe('Tortoise AI');
    expect(getRouteTitle('/administration')).toBe('Administration');
    expect(getRouteTitle('/security')).toBe('Account & Security');
  });
});
