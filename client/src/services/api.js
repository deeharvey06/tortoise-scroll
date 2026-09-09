import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((request) => {
  const method = String(request.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method))
    request.headers.set('X-CSRF-Protection', '1');
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = String(error?.config?.url || '');
    const isAuthEntryRequest = /\/auth\/(login|register|me)$/.test(path);
    if (!isAuthEntryRequest && error?.response?.status === 401)
      window.dispatchEvent(
        new CustomEvent('tortoise:auth', { detail: 'SESSION_EXPIRED' }),
      );
    if (!isAuthEntryRequest && error?.response?.status === 403) {
      const message = String(error.response?.data?.error?.message || '');
      window.dispatchEvent(
        new CustomEvent('tortoise:auth', {
          detail: /not active/i.test(message)
            ? 'ACCOUNT_SUSPENDED'
            : 'FORBIDDEN',
        }),
      );
    }
    return Promise.reject(error);
  },
);

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
