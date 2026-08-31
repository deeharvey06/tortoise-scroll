import api from './api';

export async function fetchEntries(params = {}) {
  const { data } = await api.get('/journal', { params });
  return data;
}

export async function fetchEntry(id) {
  const { data } = await api.get(`/journal/${id}`);
  return data;
}

export async function createEntry(payload) {
  const { data } = await api.post('/journal', payload);
  return data;
}

export async function updateEntry(id, payload) {
  const { data } = await api.put(`/journal/${id}`, payload);
  return data;
}

export async function deleteEntry(id) {
  await api.delete(`/journal/${id}`);
}

export default { fetchEntries, fetchEntry, createEntry, updateEntry, deleteEntry };
