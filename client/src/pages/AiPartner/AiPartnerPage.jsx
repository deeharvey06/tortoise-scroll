import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import * as aiApi from '../../services/aiService';
import { useFilterParams } from '../../store/useFilterStore';
import AgentsPanel from './AgentsPanel';

const SUGGESTIONS = [
  'What is my best setup?',
  'Which setup loses the most money?',
  'What time of day am I most profitable?',
  'How do I perform after two consecutive losses?',
  'Am I more profitable long or short?',
  'What are my biggest recurring mistakes?',
  'Compare my last 30 trades to the previous 30.',
];

function SettingsPanel({ settings, onSave, saving }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField select label="Provider" fullWidth size="small" value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
            <MenuItem value="disabled">Disabled</MenuItem>
            <MenuItem value="openai">OpenAI</MenuItem>
            <MenuItem value="ollama">Ollama (local)</MenuItem>
          </TextField>
        </Grid>
        {form.provider === 'openai' && (
          <>
            <Grid item xs={12} sm={4}>
              <TextField
                label={form.openaiApiKeySet ? 'API key (already set — leave blank to keep)' : 'OpenAI API key'}
                type="password"
                fullWidth
                size="small"
                value={form.openaiApiKey || ''}
                onChange={(e) => setForm((f) => ({ ...f, openaiApiKey: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Model" fullWidth size="small" value={form.openaiModel} onChange={(e) => setForm((f) => ({ ...f, openaiModel: e.target.value }))} />
            </Grid>
          </>
        )}
        {form.provider === 'ollama' && (
          <>
            <Grid item xs={12} sm={4}>
              <TextField label="Base URL" fullWidth size="small" value={form.ollamaBaseUrl} onChange={(e) => setForm((f) => ({ ...f, ollamaBaseUrl: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Model" fullWidth size="small" value={form.ollamaModel} onChange={(e) => setForm((f) => ({ ...f, ollamaModel: e.target.value }))} />
            </Grid>
          </>
        )}
        <Grid item xs={12} sm={4}>
          <Typography variant="caption" color="text.secondary">
            Temperature: {form.temperature}
          </Typography>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.1}
            value={form.temperature}
            onChange={(e, v) => setForm((f) => ({ ...f, temperature: v }))}
          />
        </Grid>
      </Grid>
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="small" variant="contained" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <CircularProgress size={16} /> : 'Save AI settings'}
        </Button>
      </Box>
    </Box>
  );
}

export default function AiPartnerPage() {
  const params = useFilterParams();
  const [pageTab, setPageTab] = useState('chat');
  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const [memories, setMemories] = useState([]);
  const [newMemory, setNewMemory] = useState('');

  const scrollRef = useRef(null);

  const loadStatusAndSettings = useCallback(async () => {
    const [s, set] = await Promise.all([aiApi.fetchAIStatus(), aiApi.fetchAISettings()]);
    setStatus(s);
    setSettings(set);
    if (!s.configured) setSettingsOpen(true);
  }, []);

  const loadConversations = useCallback(async () => {
    const list = await aiApi.fetchConversations();
    setConversations(list);
  }, []);

  const loadMemories = useCallback(async () => {
    const list = await aiApi.fetchMemories();
    setMemories(list);
  }, []);

  useEffect(() => {
    loadStatusAndSettings().catch((err) => setError(err.message));
    loadConversations().catch(() => {});
    loadMemories().catch(() => {});
  }, [loadStatusAndSettings, loadConversations, loadMemories]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSaveSettings = async (form) => {
    setSavingSettings(true);
    setError(null);
    try {
      const saved = await aiApi.saveAISettings(form);
      setSettings(saved);
      const s = await aiApi.fetchAIStatus();
      setStatus(s);
      if (s.configured) setSettingsOpen(false);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const openConversation = async (id) => {
    setActiveId(id);
    setError(null);
    try {
      const conv = await aiApi.fetchConversation(id);
      setMessages(conv.messages);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const startNewConversation = () => {
    setActiveId(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (id) => {
    await aiApi.deleteConversation(id);
    if (activeId === id) startNewConversation();
    loadConversations();
  };

  const handleSend = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setSending(true);
    try {
      const data = await aiApi.sendChatMessage({ conversationId: activeId, message, filters: params });
      setActiveId(data.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
      if (data.memorySaved) loadMemories();
      loadConversations();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
      setMessages((m) => m.slice(0, -1)); // remove the optimistic user message's pending state on failure
    } finally {
      setSending(false);
    }
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return;
    try {
      await aiApi.createMemory({ content: newMemory.trim() });
      setNewMemory('');
      loadMemories();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleDeleteMemory = async (id) => {
    await aiApi.deleteMemory(id);
    loadMemories();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h5">AI Trading Partner</Typography>
        <IconButton size="small" aria-label="Toggle AI settings" onClick={() => setSettingsOpen((o) => !o)}>
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Box>

      <Tabs value={pageTab} onChange={(e, v) => setPageTab(v)} sx={{ mb: 2 }}>
        <Tab value="chat" label="Chat" />
        <Tab value="agents" label="Agents" />
      </Tabs>

      {pageTab === 'agents' ? (
        <AgentsPanel />
      ) : (
        <>
      {status && !status.configured && (
        <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />} sx={{ mb: 2 }}>
          AI is not configured yet. The rest of the app works fully without it. Choose a provider below to enable chat.
        </Alert>
      )}

      {settings && (
        <Collapse in={settingsOpen}>
          <Paper sx={{ mb: 2 }}>
            <SettingsPanel settings={settings} onSave={handleSaveSettings} saving={savingSettings} />
          </Paper>
        </Collapse>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ height: 620 }}>
        <Grid item xs={12} md={3} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">Conversations</Typography>
              <IconButton size="small" aria-label="New conversation" onClick={startNewConversation}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
            <Divider />
            <List dense sx={{ flex: 1, overflowY: 'auto' }}>
              {conversations.map((c) => (
                <ListItemButton key={c._id} selected={c._id === activeId} onClick={() => openConversation(c._id)}>
                  <ListItemText
                    primary={c.title}
                    secondary={c.lastMessage}
                    primaryTypographyProps={{ noWrap: true, fontSize: 13 }}
                    secondaryTypographyProps={{ noWrap: true, fontSize: 11 }}
                  />
                  <IconButton size="small" aria-label="Delete conversation" onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c._id); }}>
                    <DeleteIcon fontSize="inherit" />
                  </IconButton>
                </ListItemButton>
              ))}
              {conversations.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                  No conversations yet.
                </Typography>
              )}
            </List>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Memories
              </Typography>
              <Box sx={{ maxHeight: 140, overflowY: 'auto', mb: 1 }}>
                {memories.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Say "remember that ..." in chat, or add one below.
                  </Typography>
                )}
                {memories.map((m) => (
                  <Chip
                    key={m._id}
                    label={m.content}
                    size="small"
                    onDelete={() => handleDeleteMemory(m._id)}
                    sx={{ mb: 0.5, mr: 0.5, maxWidth: '100%' }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="Add a memory"
                  fullWidth
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
                />
                <Button size="small" onClick={handleAddMemory}>
                  Add
                </Button>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={9} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {messages.length === 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Ask about your actual trading history — every answer is grounded in your logged trades.
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {SUGGESTIONS.map((s) => (
                      <Chip key={s} label={s} size="small" onClick={() => handleSend(s)} sx={{ cursor: 'pointer' }} />
                    ))}
                  </Box>
                </Box>
              )}
              {messages.map((m, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', mb: 1.5 }}>
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '75%',
                      backgroundColor: m.role === 'user' ? 'rgba(76, 141, 255, 0.12)' : 'background.paper',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Typography variant="body2">{m.content}</Typography>
                  </Paper>
                </Box>
              ))}
              {sending && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Thinking…
                  </Typography>
                </Box>
              )}
            </Box>
            <Divider />
            <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={status?.configured ? 'Ask about your trading…' : 'Configure AI above to start chatting'}
                value={input}
                disabled={!status?.configured}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <Tooltip title={status?.configured ? '' : 'Configure AI first'}>
                <span>
                  <IconButton color="primary" aria-label="Send message" onClick={() => handleSend()} disabled={!status?.configured || sending}>
                    <SendIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        </Grid>
      </Grid>
        </>
      )}
    </Box>
  );
}
