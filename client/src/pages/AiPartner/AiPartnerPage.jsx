import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
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
import PageHeader from '../../components/PageHeader';
import { EmptyState, ErrorState, Panel, SectionHeader, StatusBadge, Tag, TradeDirection, ProfitLossValue, RMultiple } from '../../components/ui';

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

function EvidencePanel({ snapshot, sampleSize }) {
  const count = snapshot?.summary?.closedTrades ?? sampleSize;
  if (!snapshot && count == null) return null;
  return (
    <Box sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant='overline' color='text.secondary'>Data / evidence</Typography>
        {count != null && <StatusBadge label={`${count} closed trade${count === 1 ? '' : 's'}`} tone='info' />}
      </Box>
      {snapshot?.filtersApplied && Object.keys(snapshot.filtersApplied).length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>{Object.entries(snapshot.filtersApplied).filter(([, value]) => value != null && value !== '').map(([key, value]) => <Tag key={key} label={`${key}: ${Array.isArray(value) ? value.join(', ') : value}`} />)}</Box>
      )}
      {snapshot?.recentTrades?.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography variant='caption' color='text.secondary'>Recent supporting trades supplied to this response</Typography>
          {snapshot.recentTrades.slice(0, 5).map((trade, index) => (
            <Box key={`${trade.symbol}-${trade.entryTime}-${index}`} sx={{ display: 'grid', gridTemplateColumns: 'minmax(64px, 1fr) auto auto auto', alignItems: 'center', gap: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Box><Typography variant='body2' sx={{ fontWeight: 700 }}>{trade.symbol}</Typography><Typography variant='caption' color='text.secondary'>{trade.setup || trade.strategy || trade.session || 'Recorded trade'}</Typography></Box>
              <TradeDirection direction={trade.direction} />
              <ProfitLossValue value={trade.netPnL} />
              <RMultiple value={trade.rMultiple} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ConversationMessage({ message }) {
  const user = message.role === 'user';
  return (
    <Box sx={{ mb: 3, ml: user ? { xs: 2, sm: 8 } : 0, mr: user ? 0 : { xs: 0, sm: 8 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant='overline' color={user ? 'text.secondary' : 'primary.main'}>{user ? 'User question' : 'AI interpretation'}</Typography>{!user && <StatusBadge label='Tortoise Insight' tone='info' />}</Box>
      <Panel sx={{ mt: 0.5, bgcolor: user ? 'action.selected' : 'background.paper' }}>
        <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{message.content}</Typography>
        {!user && <EvidencePanel snapshot={message.contextSnapshot} sampleSize={message.sampleSize} />}
      </Panel>
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
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, sampleSize: data.sampleSize }]);
      aiApi.fetchConversation(data.conversationId).then((conversation) => setMessages(conversation.messages)).catch(() => {});
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
      <PageHeader eyebrow='Analytical research assistant' title='Tortoise AI' description='Ask questions of your recorded trading history. Your data remains the evidence; AI provides interpretation.' actions={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{status && <StatusBadge label={status.configured ? 'Configured' : 'Not configured'} tone={status.configured ? 'positive' : 'neutral'} />}<IconButton size="small" aria-label="Toggle AI settings" onClick={() => setSettingsOpen((o) => !o)}><SettingsIcon fontSize="small" /></IconButton></Box>} />

      <Tabs value={pageTab} onChange={(e, v) => setPageTab(v)} sx={{ mb: 2 }}>
        <Tab value="chat" label="Chat" />
        <Tab value="agents" label="Research tools" />
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
          <Panel sx={{ mb: 4 }}>
            <SectionHeader eyebrow='Configuration' title='AI provider settings' description='Presentation settings are separate from your trading data and analytics.' />
            <SettingsPanel settings={settings} onSave={handleSaveSettings} saving={savingSettings} />
          </Panel>
        </Collapse>
      )}

      {error && <ErrorState compact message={error} onClose={() => setError(null)} sx={{ mb: 4 }} />}

      <Grid container spacing={2} sx={{ height: { xs: 'auto', md: 640 } }}>
        <Grid item xs={12} md={3} sx={{ height: { xs: 360, md: '100%' } }}>
          <Panel padding={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="overline" color='text.secondary'>Research history</Typography>
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
              {conversations.length === 0 && <EmptyState compact title='No conversations yet' description='Start a research question to create a history.' />}
            </List>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Research memory
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
          </Panel>
        </Grid>

        <Grid item xs={12} md={9} sx={{ height: { xs: 640, md: '100%' } }}>
          <Panel padding={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {messages.length === 0 && (
                <Box sx={{ p: 2 }}>
                  <SectionHeader eyebrow='Research prompt' title='Ask your trading record' description='Tortoise AI interprets the deterministic data supplied by your journal. It does not generate trading signals.' />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {SUGGESTIONS.map((s) => (
                      <Chip key={s} label={s} size="small" onClick={() => handleSend(s)} sx={{ cursor: 'pointer' }} />
                    ))}
                  </Box>
                </Box>
              )}
              {messages.map((message, index) => <ConversationMessage key={`${message.createdAt || 'message'}-${index}`} message={message} />)}
              {sending && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Reviewing the available evidence…
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
          </Panel>
        </Grid>
      </Grid>
        </>
      )}
    </Box>
  );
}
