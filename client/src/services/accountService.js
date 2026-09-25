import api from '@/services/api';

export async function fetchAccounts({ activeOnly = false, signal } = {}) {
  const { data } = await api.get('/accounts', {
    params: activeOnly ? { active: 'true' } : undefined,
    signal,
  });
  return data;
}

export async function fetchAccount(id) {
  const { data } = await api.get(`/accounts/${id}`);
  return data;
}

export async function createAccount(payload) {
  const { data } = await api.post('/accounts', payload);
  return data;
}

export async function updateAccount(id, payload) {
  const { data } = await api.put(`/accounts/${id}`, payload);
  return data;
}

export async function deleteAccount(id) {
  await api.delete(`/accounts/${id}`);
}

export async function archiveAccount(id) {
  const { data } = await api.post(`/accounts/${id}/archive`);
  return data;
}

export async function restoreAccount(id) {
  const { data } = await api.post(`/accounts/${id}/restore`);
  return data;
}

export async function setDefaultAccount(id) {
  const { data } = await api.post(`/accounts/${id}/default`);
  return data;
}

export async function fetchAccountPerformance(id) {
  const { data } = await api.get(`/accounts/${id}/performance`);
  return data;
}

export async function fetchAccountImportHistory(id) {
  const { data } = await api.get(`/accounts/${id}/import-history`);
  return data;
}

export default {
  fetchAccounts,
  fetchAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  archiveAccount,
  restoreAccount,
  setDefaultAccount,
  fetchAccountPerformance,
  fetchAccountImportHistory,
};
