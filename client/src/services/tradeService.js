import api from './api';

export async function fetchTrades(params = {}) {
  const { data } = await api.get('/trades', { params });
  return data; // { items, pagination }
}

export async function fetchTrade(id) {
  const { data } = await api.get(`/trades/${id}`);
  return data;
}

export async function createTrade(payload) {
  const { data } = await api.post('/trades', payload);
  return data;
}

export async function updateTrade(id, payload) {
  const { data } = await api.put(`/trades/${id}`, payload);
  return data;
}

export async function deleteTrade(id) {
  await api.delete(`/trades/${id}`);
}

export async function fetchAccounts() {
  const { data } = await api.get('/accounts');
  return data;
}

export async function createAccount(payload) {
  const { data } = await api.post('/accounts', payload);
  return data;
}

export async function bulkDeleteTrades(ids) {
  const { data } = await api.post('/trades/bulk-delete', { ids });
  return data;
}

export async function bulkTagTrades(ids, tags) {
  const { data } = await api.post('/trades/bulk-tag', { ids, tags });
  return data;
}

export function exportTradesUrl(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return `/api/trades/export${qs ? `?${qs}` : ''}`;
}

export async function uploadScreenshot(tradeId, file, caption) {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const { data } = await api.post(`/trades/${tradeId}/screenshots`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateScreenshotCaption(tradeId, screenshotId, caption) {
  const { data } = await api.put(`/trades/${tradeId}/screenshots/${screenshotId}`, { caption });
  return data;
}

export async function deleteScreenshot(tradeId, screenshotId) {
  const { data } = await api.delete(`/trades/${tradeId}/screenshots/${screenshotId}`);
  return data;
}

export default {
  fetchTrades,
  fetchTrade,
  createTrade,
  updateTrade,
  deleteTrade,
  fetchAccounts,
  createAccount,
  bulkDeleteTrades,
  bulkTagTrades,
  exportTradesUrl,
  uploadScreenshot,
  updateScreenshotCaption,
  deleteScreenshot,
};
