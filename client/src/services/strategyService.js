import api from './api';

export async function fetchStrategies() {
  const { data } = await api.get('/strategies');
  return data;
}

export async function fetchStrategy(id) {
  const { data } = await api.get(`/strategies/${id}`);
  return data;
}

export async function createStrategy(payload) {
  const { data } = await api.post('/strategies', payload);
  return data;
}

export async function updateStrategy(id, payload) {
  const { data } = await api.put(`/strategies/${id}`, payload);
  return data;
}

export async function deleteStrategy(id) {
  await api.delete(`/strategies/${id}`);
}

export async function fetchStrategyPerformance(id) {
  const { data } = await api.get(`/strategies/${id}/performance`);
  return data;
}

export async function uploadStrategyImage(id, file, caption) {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const { data } = await api.post(`/strategies/${id}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateStrategyImageCaption(id, imageId, caption) {
  const { data } = await api.put(`/strategies/${id}/images/${imageId}`, { caption });
  return data;
}

export async function deleteStrategyImage(id, imageId) {
  const { data } = await api.delete(`/strategies/${id}/images/${imageId}`);
  return data;
}

export default {
  fetchStrategies,
  fetchStrategy,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  fetchStrategyPerformance,
  uploadStrategyImage,
  updateStrategyImageCaption,
  deleteStrategyImage,
};
