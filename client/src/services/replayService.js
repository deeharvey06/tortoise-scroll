import api from './api';

export async function fetchReplaySession(date, params = {}) {
  const { data } = await api.get('/replay/session', { params: { ...params, date } });
  return data;
}

export async function fetchMarketDataStatus() {
  const { data } = await api.get('/replay/market-data-status');
  return data;
}

export default { fetchReplaySession, fetchMarketDataStatus };
