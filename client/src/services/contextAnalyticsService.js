import api from '@/services/api';

export async function compareContext(params) {
  const { data } = await api.post('/knowledge/analytics', params);
  return data;
}
