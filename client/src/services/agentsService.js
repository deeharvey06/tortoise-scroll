import api from './api';

// Agent 1 — Auto Trade Tagger
export async function fetchTaggingRules() {
  const { data } = await api.get('/agents/tagging-rules');
  return data;
}
export async function createTaggingRule(payload) {
  const { data } = await api.post('/agents/tagging-rules', payload);
  return data;
}
export async function updateTaggingRule(id, payload) {
  const { data } = await api.put(`/agents/tagging-rules/${id}`, payload);
  return data;
}
export async function deleteTaggingRule(id) {
  await api.delete(`/agents/tagging-rules/${id}`);
}
export async function runAutoTagger(tradeIds) {
  const { data } = await api.post('/agents/auto-tagger/run', { tradeIds });
  return data;
}
export async function approveTagSuggestion(tradeId, tags) {
  const { data } = await api.post('/agents/auto-tagger/approve', { tradeId, tags });
  return data;
}

// Agent 2 — Session Review
export async function fetchSessionReview(date, params = {}) {
  const { data } = await api.get('/agents/session-review', { params: { ...params, date } });
  return data;
}

// Agent 3 — Pre-Market Briefing
export async function fetchPreMarketBriefing(params = {}) {
  const { data } = await api.get('/agents/pre-market', { params });
  return data;
}

// Agent 4 — Risk Monitor
export async function fetchRiskAlert(accountId) {
  const { data } = await api.get('/agents/risk-monitor', { params: accountId ? { accountId } : {} });
  return data;
}

// Agent 5 — Performance Patterns
export async function fetchPerformancePatterns(params = {}) {
  const { data } = await api.get('/agents/performance-patterns', { params });
  return data;
}

export default {
  fetchTaggingRules,
  createTaggingRule,
  updateTaggingRule,
  deleteTaggingRule,
  runAutoTagger,
  approveTagSuggestion,
  fetchSessionReview,
  fetchPreMarketBriefing,
  fetchRiskAlert,
  fetchPerformancePatterns,
};
