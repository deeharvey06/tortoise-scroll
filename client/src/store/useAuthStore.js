import { create } from 'zustand';

const STORAGE_KEY = 'tortoise-scroll-auth';

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };

    const parsed = JSON.parse(raw);
    return {
      user: parsed.user || null,
      token: parsed.token || null,
    };
  } catch {
    return { user: null, token: null };
  }
};

export const useAuthStore = create((set) => ({
  user: readStoredAuth().user,
  token: readStoredAuth().token,
  setSession: (user, token) => {
    const payload = { user, token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    set({ user, token });
  },
  clearSession: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
