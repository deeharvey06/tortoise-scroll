import api from '@/services/api';

export async function searchWorkspace(query, signal) {
  const { data } = await api.get('/search', { params: { q: query }, signal });
  return data.groups;
}
