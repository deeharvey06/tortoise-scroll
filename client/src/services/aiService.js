import api from './api';

export async function fetchAIStatus() {
  const { data } = await api.get('/ai/status');
  return data;
}

export async function fetchAISettings() {
  const { data } = await api.get('/ai/settings');
  return data;
}

export async function saveAISettings(payload) {
  const { data } = await api.put('/ai/settings', payload);
  return data;
}

export async function sendChatMessage({ conversationId, message, filters }) {
  const { data } = await api.post('/ai/chat', { conversationId, message, filters });
  return data;
}

export async function fetchConversations() {
  const { data } = await api.get('/ai/conversations');
  return data;
}

export async function fetchConversation(id) {
  const { data } = await api.get(`/ai/conversations/${id}`);
  return data;
}

export async function deleteConversation(id) {
  await api.delete(`/ai/conversations/${id}`);
}

export async function fetchMemories() {
  const { data } = await api.get('/ai/memories');
  return data;
}

export async function createMemory(payload) {
  const { data } = await api.post('/ai/memories', payload);
  return data;
}

export async function deleteMemory(id) {
  await api.delete(`/ai/memories/${id}`);
}

export default {
  fetchAIStatus,
  fetchAISettings,
  saveAISettings,
  sendChatMessage,
  fetchConversations,
  fetchConversation,
  deleteConversation,
  fetchMemories,
  createMemory,
  deleteMemory,
};
