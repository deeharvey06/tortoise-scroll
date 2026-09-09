import api from './api';

export async function fetchUsers(params = {}) {
  const { data } = await api.get('/admin/users', { params });
  return data;
}
export async function fetchUser(id) {
  const { data } = await api.get(`/admin/users/${id}`);
  return data;
}
export async function changeUserRole(id, role) {
  const { data } = await api.patch(`/admin/users/${id}/role`, { role });
  return data;
}
export async function changeUserStatus(id, status) {
  const { data } = await api.patch(`/admin/users/${id}/status`, { status });
  return data;
}
export async function fetchAuditLog(params = {}) {
  const { data } = await api.get('/admin/audit-log', { params });
  return data;
}

export default {
  fetchUsers,
  fetchUser,
  changeUserRole,
  changeUserStatus,
  fetchAuditLog,
};
