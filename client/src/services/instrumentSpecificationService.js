import api from './api';

export async function fetchInstrumentSpecifications() {
  const { data } = await api.get('/instrument-specifications');
  return data;
}
export async function resolveInstrumentSpecification(
  symbol,
  assetType = 'future'
) {
  const { data } = await api.get('/instrument-specifications/resolve', {
    params: { symbol, assetType },
  });
  return data;
}
export async function createInstrumentSpecification(payload) {
  const { data } = await api.post('/instrument-specifications', payload);
  return data;
}
export async function updateInstrumentSpecification(id, payload) {
  const { data } = await api.put(`/instrument-specifications/${id}`, payload);
  return data;
}
export async function deleteInstrumentSpecification(id) {
  await api.delete(`/instrument-specifications/${id}`);
}

export default {
  fetchInstrumentSpecifications,
  resolveInstrumentSpecification,
  createInstrumentSpecification,
  updateInstrumentSpecification,
  deleteInstrumentSpecification,
};
