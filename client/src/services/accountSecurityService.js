import api from './api';

export async function fetchAccountSecurity() {
  const { data } = await api.get('/account-security');
  return data;
}
export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.patch('/account-security/password', {
    currentPassword,
    newPassword,
  });
  return data;
}
export async function fetchSessions() {
  const { data } = await api.get('/account-security/sessions');
  return data;
}
export async function revokeSession(id) {
  await api.delete(`/account-security/sessions/${id}`);
}
export async function logoutOtherSessions() {
  const { data } = await api.post('/account-security/sessions/logout-others');
  return data;
}

export default {
  fetchAccountSecurity,
  changePassword,
  fetchSessions,
  revokeSession,
  logoutOtherSessions,
};
