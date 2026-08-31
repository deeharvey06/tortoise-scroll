import api from './api';

export async function fetchAppSettings() {
  const { data } = await api.get('/settings');
  return data;
}

export async function saveAppSettings(payload) {
  const { data } = await api.put('/settings', payload);
  return data;
}

export default { fetchAppSettings, saveAppSettings };
