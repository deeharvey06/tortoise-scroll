import axios from 'axios';
import useAuthStore from '../store/useAuthStore';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
