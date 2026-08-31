import api from './api';

export async function fetchAdapters() {
  const { data } = await api.get('/import/adapters');
  return data;
}

export async function previewCsv(file, broker) {
  const form = new FormData();
  form.append('file', file);
  form.append('broker', broker);
  const { data } = await api.post('/import/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function commitCsv({ file, accountId, broker, mapping }) {
  const form = new FormData();
  form.append('file', file);
  form.append('accountId', accountId);
  form.append('broker', broker);
  form.append('mapping', JSON.stringify(mapping));
  const { data } = await api.post('/import/commit', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export default { fetchAdapters, previewCsv, commitCsv };
