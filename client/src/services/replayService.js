import api from './api';

export async function fetchReplaySession(date, params = {}) {
  const { data } = await api.get('/replay/session', {
    params: { ...params, date },
  });
  return data;
}

export async function fetchMarketDataStatus() {
  const { data } = await api.get('/replay/market-data-status');
  return data;
}

export default { fetchReplaySession, fetchMarketDataStatus };

export const fetchReplayDatasets = async () =>
  (await api.get('/replay/datasets')).data;
export const listReplayRuns = async () => (await api.get('/replay/runs')).data;
export const createReplayRun = async (input) =>
  (await api.post('/replay/runs', input)).data;
export const getReplayRun = async (id) =>
  (await api.get(`/replay/runs/${id}`)).data;
export const controlReplay = async (id, input) =>
  (await api.post(`/replay/runs/${id}/control`, input)).data;
export const addReplayEvent = async (id, input) =>
  (await api.post(`/replay/runs/${id}/events`, input)).data;
export const removeReplayEvent = async (id, eventId, version) =>
  (
    await api.delete(`/replay/runs/${id}/events/${eventId}`, {
      data: { version },
    })
  ).data;
export async function saveReplayScreenshot(id, blob, version) {
  const form = new FormData();
  form.append('file', blob, 'replay.png');
  form.append('version', String(version));
  return (
    await api.post(`/replay/runs/${id}/screenshots`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data;
}
