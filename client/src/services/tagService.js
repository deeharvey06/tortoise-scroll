import api from './api';

export async function fetchTags() {
  const { data } = await api.get('/tags');
  return data;
}

export async function createTag(payload) {
  const { data } = await api.post('/tags', payload);
  return data;
}

export async function deleteTag(id) {
  await api.delete(`/tags/${id}`);
}

export default { fetchTags, createTag, deleteTag };
