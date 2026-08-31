import api from './api';

export async function fetchReport(category, params = {}) {
  const { data } = await api.get(`/reports/${category}`, { params });
  return data;
}

export default { fetchReport };
