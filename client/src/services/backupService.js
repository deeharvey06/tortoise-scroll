import api from './api';

export async function exportBackup() {
  const { data } = await api.get('/backup/export');
  return data;
}

export async function importBackup(backupJson, confirm) {
  const { data } = await api.post('/backup/import', { ...backupJson, confirm });
  return data;
}

export default { exportBackup, importBackup };
