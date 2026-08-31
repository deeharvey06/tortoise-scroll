import api from './api';

export async function fetchRiskSettings(accountId) {
  const { data } = await api.get('/risk/settings', { params: accountId ? { accountId } : {} });
  return data;
}

export async function saveRiskSettings(payload) {
  const { data } = await api.put('/risk/settings', payload);
  return data;
}

export async function fetchRiskDashboard(accountId) {
  const { data } = await api.get('/risk/dashboard', { params: accountId ? { accountId } : {} });
  return data;
}

export default { fetchRiskSettings, saveRiskSettings, fetchRiskDashboard };
