import api from './api';

export async function fetchBacktestStatus() {
  const { data } = await api.get('/backtest/status');
  return data;
}

export async function fetchConfigs() {
  const { data } = await api.get('/backtest/configs');
  return data;
}

export async function fetchConfig(id) {
  const { data } = await api.get(`/backtest/configs/${id}`);
  return data;
}

export async function createConfig(payload) {
  const { data } = await api.post('/backtest/configs', payload);
  return data;
}

export async function updateConfig(id, payload) {
  const { data } = await api.put(`/backtest/configs/${id}`, payload);
  return data;
}

export async function deleteConfig(id) {
  await api.delete(`/backtest/configs/${id}`);
}

export async function runConfig(id) {
  const { data } = await api.post(`/backtest/configs/${id}/run`);
  return data;
}

export default { fetchBacktestStatus, fetchConfigs, fetchConfig, createConfig, updateConfig, deleteConfig, runConfig };
