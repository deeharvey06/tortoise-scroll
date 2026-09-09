import { create } from 'zustand';
import authService from '../services/authService';

export const useAuthStore = create((set) => ({
  status: 'INITIALIZING',
  user: null,
  initialize: async () => {
    try {
      const { user } = await authService.me();
      set({ user, status: 'AUTHENTICATED' });
    } catch (error) {
      if (!error?.response) set({ user: null, status: 'NETWORK_ERROR' });
      else if (error.response.status === 403) set({ user: null, status: 'ACCOUNT_SUSPENDED' });
      else set({ user: null, status: 'UNAUTHENTICATED' });
    }
  },
  setAuthenticatedUser: (user) => set({ user, status: 'AUTHENTICATED' }),
  setAuthStatus: (status) => set((state) => ({ user: status === 'FORBIDDEN' ? state.user : null, status })),
  clearSession: () => set({ user: null, status: 'UNAUTHENTICATED' }),
}));

export default useAuthStore;
