import AISettings from '../models/AISettings.js';

/**
 * Loads effective AI settings: whatever's saved in the DB singleton,
 * falling back to .env defaults if no DB document exists yet. This lets
 * the app work out of the box from .env while still being editable from
 * the UI without a restart.
 */
export async function getEffectiveSettings() {
  const saved = await AISettings.findOne().lean();
  if (saved) return saved;
  return {
    provider: process.env.AI_PROVIDER || 'disabled',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1',
    temperature: 0.3,
  };
}

export async function isConfigured() {
  const settings = await getEffectiveSettings();
  if (settings.provider === 'openai') return !!settings.openaiApiKey;
  if (settings.provider === 'ollama') return !!settings.ollamaBaseUrl;
  return false;
}

async function callOpenAI(settings, messages) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      messages,
      temperature: settings.temperature,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(settings, messages) {
  const response = await fetch(`${settings.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ollamaModel,
      messages,
      stream: false,
      options: { temperature: settings.temperature },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  return data.message?.content || '';
}

/**
 * Sends a chat completion request to whichever provider is configured.
 * `messages` is the standard [{role, content}] array; the caller is
 * responsible for building the system prompt with deterministic data.
 */
export async function chatComplete(messages) {
  const settings = await getEffectiveSettings();

  if (settings.provider === 'openai') {
    if (!settings.openaiApiKey) throw new Error('OpenAI is selected but no API key is configured.');
    return callOpenAI(settings, messages);
  }
  if (settings.provider === 'ollama') {
    return callOllama(settings, messages);
  }

  const err = new Error(
    'AI is not configured. Choose a provider (OpenAI or Ollama) and save the settings on the AI Trading Partner page.'
  );
  err.code = 'AI_NOT_CONFIGURED';
  throw err;
}

export default { getEffectiveSettings, isConfigured, chatComplete };
