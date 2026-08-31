import api from './api';

export async function fetchPlaybooks() {
  const { data } = await api.get('/playbooks');
  return data;
}

export async function fetchPlaybook(id) {
  const { data } = await api.get(`/playbooks/${id}`);
  return data;
}

export async function createPlaybook(payload) {
  const { data } = await api.post('/playbooks', payload);
  return data;
}

export async function updatePlaybook(id, payload) {
  const { data } = await api.put(`/playbooks/${id}`, payload);
  return data;
}

export async function deletePlaybook(id) {
  await api.delete(`/playbooks/${id}`);
}

export async function fetchPlaybookPerformance(id) {
  const { data } = await api.get(`/playbooks/${id}/performance`);
  return data;
}

export async function uploadPlaybookImage(id, file, caption) {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const { data } = await api.post(`/playbooks/${id}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updatePlaybookImageCaption(id, imageId, caption) {
  const { data } = await api.put(`/playbooks/${id}/images/${imageId}`, { caption });
  return data;
}

export async function deletePlaybookImage(id, imageId) {
  const { data } = await api.delete(`/playbooks/${id}/images/${imageId}`);
  return data;
}

export default {
  fetchPlaybooks,
  fetchPlaybook,
  createPlaybook,
  updatePlaybook,
  deletePlaybook,
  fetchPlaybookPerformance,
  uploadPlaybookImage,
  updatePlaybookImageCaption,
  deletePlaybookImage,
};
