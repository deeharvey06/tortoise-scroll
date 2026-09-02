import { create } from 'zustand';
import authService from '../services/authService';

export const useAuthStore = create((set) => ({
  status: 'INITIALIZING',
  user: null,
  initialize: async () => {
    try {
      const { user } = await authService.me();
      set({ user, status: 'AUTHENTICATED' });
    } catch {
      set({ user: null, status: 'UNAUTHENTICATED' });
    }
  },
  setAuthenticatedUser: (user) => set({ user, status: 'AUTHENTICATED' }),
  clearSession: () => set({ user: null, status: 'UNAUTHENTICATED' }),
}));

export default useAuthStore;
