import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export async function checkHealth() {
  const { data } = await api.get('/health');
  return data;
}

export default api;
