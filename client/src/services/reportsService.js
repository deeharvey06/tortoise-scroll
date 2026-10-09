import api from '@/services/api';

export async function fetchReport(category, params = {}, signal) {
  const { data } = await api.get(`/reports/${category}`, { params, signal });
  return data;
}

export default { fetchReport };
