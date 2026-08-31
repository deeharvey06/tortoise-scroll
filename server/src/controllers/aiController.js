import AIConversation from '../models/AIConversation.js';
import AIMemory from '../models/AIMemory.js';
import AISettings from '../models/AISettings.js';
import * as providerClient from '../ai/providerClient.js';
import * as contextService from '../ai/contextService.js';
import { buildSystemPrompt } from '../ai/promptBuilder.js';

export async function getStatus(req, res) {
  const settings = await providerClient.getEffectiveSettings();
  const configured = await providerClient.isConfigured();
  res.json({ configured, provider: settings.provider });
}

export async function getSettings(req, res) {
  const settings = await providerClient.getEffectiveSettings();
  // Never send the raw API key back — only whether one is set.
  res.json({
    provider: settings.provider,
    openaiApiKeySet: !!settings.openaiApiKey,
    openaiModel: settings.openaiModel,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    ollamaModel: settings.ollamaModel,
    temperature: settings.temperature,
  });
}

export async function saveSettings(req, res) {
  const { provider, openaiApiKey, openaiModel, ollamaBaseUrl, ollamaModel, temperature } = req.body;
  const existing = await AISettings.findOne();
  const update = { provider, openaiModel, ollamaBaseUrl, ollamaModel, temperature };
  // Only overwrite the stored API key if a new non-empty one was submitted,
  // so re-saving other fields doesn't blank it out.
  if (openaiApiKey) update.openaiApiKey = openaiApiKey;

  const saved = existing
    ? await AISettings.findByIdAndUpdate(existing._id, update, { new: true, runValidators: true })
    : await AISettings.create(update);

  res.json({
    provider: saved.provider,
    openaiApiKeySet: !!saved.openaiApiKey,
    openaiModel: saved.openaiModel,
    ollamaBaseUrl: saved.ollamaBaseUrl,
    ollamaModel: saved.ollamaModel,
    temperature: saved.temperature,
  });
}

export async function listConversations(req, res) {
  const conversations = await AIConversation.find()
    .select('title createdAt updatedAt messages')
    .sort({ updatedAt: -1 })
    .lean();
  res.json(
    conversations.map((c) => ({
      _id: c._id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
      lastMessage: c.messages[c.messages.length - 1]?.content?.slice(0, 120) || '',
    }))
  );
}

export async function getConversation(req, res) {
  const conversation = await AIConversation.findById(req.params.id).lean();
  if (!conversation) {
    res.status(404);
    throw new Error('Conversation not found');
  }
  res.json(conversation);
}

export async function deleteConversation(req, res) {
  const deleted = await AIConversation.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error('Conversation not found');
  }
  res.status(204).send();
}

// Very small, deterministic "remember" trigger — no LLM function-calling
// needed. If the user explicitly asks to remember something, we save it
// verbatim rather than trying to infer memories from ordinary chat.
const REMEMBER_PATTERN = /^\s*remember\s+(that\s+)?(.+)/i;

async function maybeExtractMemory(message) {
  const match = message.match(REMEMBER_PATTERN);
  if (!match) return null;
  const content = match[2].trim();
  if (!content) return null;
  return AIMemory.create({ content, category: 'other' });
}

export async function chat(req, res) {
  const { conversationId, message, filters } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error('message is required');
  }

  const configured = await providerClient.isConfigured();
  if (!configured) {
    res.status(503);
    throw new Error(
      'AI is not configured. Choose a provider and save settings on this page before chatting — the rest of the ' +
        'app works fully without it.'
    );
  }

  let conversation = conversationId ? await AIConversation.findById(conversationId) : null;
  if (!conversation) {
    conversation = new AIConversation({ title: message.slice(0, 60) });
  }

  const savedMemory = await maybeExtractMemory(message);
  const memories = await AIMemory.find().sort({ createdAt: -1 }).lean();

  const contextBundle = await contextService.buildContextBundle(filters || {});
  const systemPrompt = buildSystemPrompt(contextBundle, memories);

  const priorMessages = conversation.messages.map((m) => ({ role: m.role, content: m.content }));
  const messages = [{ role: 'system', content: systemPrompt }, ...priorMessages, { role: 'user', content: message }];

  const replyText = await providerClient.chatComplete(messages);

  conversation.messages.push({ role: 'user', content: message });
  conversation.messages.push({ role: 'assistant', content: replyText, contextSnapshot: contextBundle });
  await conversation.save();

  res.json({
    conversationId: conversation._id,
    reply: replyText,
    memorySaved: savedMemory ? { content: savedMemory.content } : null,
    sampleSize: contextBundle.summary.closedTrades,
  });
}

export async function listMemories(req, res) {
  const memories = await AIMemory.find().sort({ createdAt: -1 }).lean();
  res.json(memories);
}

export async function createMemory(req, res) {
  const { content, category } = req.body;
  if (!content || !content.trim()) {
    res.status(400);
    throw new Error('content is required');
  }
  const memory = await AIMemory.create({ content: content.trim(), category: category || 'other' });
  res.status(201).json(memory);
}

export async function deleteMemory(req, res) {
  const deleted = await AIMemory.findByIdAndDelete(req.params.id);
  if (!deleted) {
    res.status(404);
    throw new Error('Memory not found');
  }
  res.status(204).send();
}

export default {
  getStatus,
  getSettings,
  saveSettings,
  listConversations,
  getConversation,
  deleteConversation,
  chat,
  listMemories,
  createMemory,
  deleteMemory,
};
