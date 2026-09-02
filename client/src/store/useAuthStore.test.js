import { beforeEach, describe, expect, it, vi } from 'vitest';
import authService from '../services/authService';
import useAuthStore from './useAuthStore';

vi.mock('../services/authService', () => ({ default: { me: vi.fn(), logout: vi.fn() } }));

describe('authentication bootstrap', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ status: 'INITIALIZING', user: null }); });
  it('uses /auth/me as the authenticated source of truth', async () => {
    const user = { id: '1', email: 'user@example.com', displayName: 'User', role: 'USER', status: 'ACTIVE' };
    authService.me.mockResolvedValue({ user });
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState()).toMatchObject({ status: 'AUTHENTICATED', user });
    expect(localStorage.getItem('tortoise-scroll-auth')).toBeNull();
  });
  it('becomes unauthenticated when bootstrap fails', async () => {
    authService.me.mockRejectedValue(new Error('unauthenticated'));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState()).toMatchObject({ status: 'UNAUTHENTICATED', user: null });
  });
});
