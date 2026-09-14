import { api } from './api';

export async function fetchProviders() {
  const { data } = await api.get('/broker-connections/providers');
  return data;
}
export async function fetchConnections() {
  const { data } = await api.get('/broker-connections');
  return data;
}
export async function beginConnection(provider) {
  const { data } = await api.post(
    `/broker-connections/${provider}/authorize`,
    {}
  );
  return data;
}
export async function reconnect(connectionId) {
  const { data } = await api.post(
    `/broker-connections/${connectionId}/reconnect`,
    {}
  );
  return data;
}
export async function fetchBrokerAccounts(connectionId) {
  const { data } = await api.get(
    `/broker-connections/${connectionId}/accounts`
  );
  return data;
}
export async function mapBrokerAccount(
  connectionId,
  providerAccountId,
  accountId
) {
  const { data } = await api.post(
    `/broker-connections/${connectionId}/mappings`,
    { providerAccountId, accountId }
  );
  return data;
}
export async function syncNow(connectionId) {
  const { data } = await api.post(
    `/broker-connections/${connectionId}/sync`,
    {}
  );
  return data;
}
export async function fetchSyncHistory(connectionId) {
  const { data } = await api.get(`/broker-connections/${connectionId}/history`);
  return data;
}
export async function disconnect(connectionId) {
  const { data } = await api.delete(`/broker-connections/${connectionId}`);
  return data;
}
