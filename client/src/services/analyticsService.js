import api from '@/services/api';

export async function fetchDashboard(params = {}, signal) {
  const { data } = await api.get('/analytics/dashboard', { params, signal });
  return data;
}

export async function fetchCalendarMonth(year, month, params = {}) {
  const { data } = await api.get('/analytics/calendar', {
    params: { ...params, year, month },
  });

  return data;
}

export default { fetchDashboard, fetchCalendarMonth };
