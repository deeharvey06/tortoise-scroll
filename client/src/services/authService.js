import api from './api';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}
export async function me() { const { data } = await api.get('/auth/me'); return data; }
export async function logout() { await api.post('/auth/logout'); }

export default { login, me, logout };
