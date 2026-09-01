import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Link as RouterLink } from 'react-router-dom';

import * as settingsApi from '../../services/settingsService';
import * as tagApi from '../../services/tagService';
import * as tradeApi from '../../services/tradeService';
import * as strategyApi from '../../services/strategyService';
import * as backupApi from '../../services/backupService';
import PageHeader from '../../components/PageHeader';
import ThemeModeSelector from '../../components/ThemeModeSelector';
import { ConfirmationDialog, EmptyState, LoadingState, Panel, SectionHeader } from '../../components/ui';

const CATEGORIES = ['setup', 'mistake', 'emotion', 'custom'];

function GeneralTab({ settings, onSave, saving, accounts }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  return (
    <Panel sx={{ maxWidth: 720 }}>
      <SectionHeader title="General preferences" description="Set the display context used throughout your journal." />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Timezone" fullWidth size="small" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} helperText="e.g. UTC, America/New_York" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField select label="Currency" fullWidth size="small" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
            {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField select label="Default account" fullWidth size="small" value={form.defaultAccountId || ''} onChange={(e) => setForm((f) => ({ ...f, defaultAccountId: e.target.value || null }))}>
            <MenuItem value="">None</MenuItem>
            {accounts.map((a) => <MenuItem key={a._id} value={a._id}>{a.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Trading hours start" fullWidth size="small" value={form.tradingHoursStart} onChange={(e) => setForm((f) => ({ ...f, tradingHoursStart: e.target.value }))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Trading hours end" fullWidth size="small" value={form.tradingHoursEnd} onChange={(e) => setForm((f) => ({ ...f, tradingHoursEnd: e.target.value }))} />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="small" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <CircularProgress size={16} /> : 'Save'}
        </Button>
      </Box>
    </Panel>
  );
}

function TradingTab({ settings, onSave, saving, strategies }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  return (
    <Panel sx={{ maxWidth: 720 }}>
      <SectionHeader title="Trading defaults" description="Defaults accelerate entry without changing trade calculations." />
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            type="number"
            label="Default risk amount ($)"
            fullWidth
            size="small"
            value={form.defaultRiskAmount ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, defaultRiskAmount: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            type="number"
            label="Default R target"
            fullWidth
            size="small"
            value={form.defaultRMultipleTarget ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, defaultRMultipleTarget: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField select label="Default strategy" fullWidth size="small" value={form.defaultStrategyId || ''} onChange={(e) => setForm((f) => ({ ...f, defaultStrategyId: e.target.value || null }))}>
            <MenuItem value="">None</MenuItem>
            {strategies.map((s) => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="small" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <CircularProgress size={16} /> : 'Save'}
        </Button>
      </Box>
    </Panel>
  );
}

function TagsTab() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('custom');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTags(await tagApi.fetchTags());
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await tagApi.createTag({ name: newName.trim(), category: newCategory });
      setNewName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleDelete = async (id) => {
    await tagApi.deleteTag(id);
    load();
  };

  return (
    <Panel sx={{ maxWidth: 760 }}>
      <SectionHeader title="Tag vocabulary" description="Maintain the consistent labels used to classify process and performance." />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tags applied on trades are free-form, but this catalog powers autocomplete and lets you manage the
        vocabulary by category (Setup / Mistake / Emotion / Custom).
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField size="small" label="New tag name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <TextField select size="small" label="Category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} sx={{ width: 140 }}>
          {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <Button size="small" onClick={handleAdd}>Add</Button>
      </Box>
      {loading ? (
        <CircularProgress size={18} />
      ) : (
        CATEGORIES.map((cat) => {
          const group = tags.filter((t) => t.category === cat);
          if (group.length === 0) return null;
          return (
            <Box key={cat} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>{cat}</Typography>
              <Box sx={{ mt: 0.5 }}>
                {group.map((t) => (
                  <Chip key={t._id} label={t.name} size="small" onDelete={() => handleDelete(t._id)} sx={{ mr: 0.5, mb: 0.5 }} />
                ))}
              </Box>
            </Box>
          );
        })
      )}
      {!loading && tags.length === 0 && <EmptyState title="No tags yet" description="Add a tag to begin building your trading vocabulary." />}
    </Panel>
  );
}

function DataTab() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const backup = await backupApi.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading-journal-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
  };

  const handleConfirmRestore = async () => {
    setConfirmOpen(false);
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const text = await pendingFile.text();
      const json = JSON.parse(text);
      const res = await backupApi.importBackup(json, true);
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to parse or restore backup file');
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Panel sx={{ mb: 4 }}>
        <SectionHeader title="Export" description="Create a portable copy of your journal data." />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Download your entire database (accounts, trades, strategies, playbooks, tags, journal, risk settings,
          backtests, AI memories/conversations) as a single JSON file. Screenshot image files are not included —
          back up <code>server/uploads</code> separately to preserve those. Your OpenAI API key is never included.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleExport} disabled={exporting}>
            {exporting ? <CircularProgress size={16} /> : 'Export full database (JSON)'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            component="a"
            href={tradeApi.exportTradesUrl()}
            target="_blank"
          >
            Export trades only (CSV)
          </Button>
        </Box>
      </Panel>

      <Panel sx={{ mb: 4 }}>
        <SectionHeader title="Restore" description="Replace current data from a previously exported Tortoise Scroll backup." />
        <Alert severity="warning" sx={{ mb: 2 }}>
          Restoring replaces every collection present in the backup file with its contents. This cannot be undone —
          export a fresh backup first if you want to keep your current data.
        </Alert>
        <Button variant="outlined" size="small" component="label" startIcon={<UploadFileIcon />} disabled={importing}>
          {importing ? <CircularProgress size={16} /> : 'Choose backup file to restore'}
          <input type="file" hidden accept=".json,application/json" onChange={(e) => handleFileSelect(e.target.files?.[0])} />
        </Button>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {result && (
          <Box sx={{ mt: 2 }}>
            <Alert severity={result.success ? 'success' : 'warning'} sx={{ mb: 1 }}>
              {result.success ? 'Restore completed successfully.' : result.warning}
            </Alert>
            {result.report.map((r) => (
              <Typography key={r.collection} variant="caption" sx={{ display: 'block' }}>
                {r.collection}: {r.error ? `failed — ${r.error}` : `${r.restored} document(s) restored`}
              </Typography>
            ))}
          </Box>
        )}
      </Panel>

      <Panel>
        <SectionHeader title="MongoDB-level backup" eyebrow="Advanced" />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          For a complete binary backup (including indexes), use MongoDB's own tools from a terminal:
        </Typography>
        <Box component="pre" sx={{ p: 1.5, backgroundColor: 'background.default', borderRadius: 1, fontSize: 12, overflow: 'auto' }}>
{`mongodump --uri="mongodb://localhost:27017/trading-journal" --out=./backup
mongorestore --uri="mongodb://localhost:27017/trading-journal" ./backup/trading-journal`}
        </Box>
      </Panel>

      <ConfirmationDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleConfirmRestore}
        title="Restore from backup?" confirmLabel="Restore and replace my data"
        description={`This permanently replaces current journal data with ${pendingFile?.name || 'the selected backup'}. This cannot be undone.`} />
    </Box>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    settingsApi.fetchAppSettings().then(setSettings).catch((e) => setError(e.message));
    tradeApi.fetchAccounts().then(setAccounts).catch(() => {});
    strategyApi.fetchStrategies().then(setStrategies).catch(() => {});
  }, []);

  const handleSave = async (form) => {
    setSaving(true);
    setError(null);
    try {
      const saved = await settingsApi.saveAppSettings(form);
      setSettings(saved);
      setToast('Settings saved');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <LoadingState label="Loading settings" />
    );
  }

  return (
    <Box>
      <PageHeader eyebrow="System" title="Settings" description="Manage Tortoise Scroll preferences, trading defaults, vocabulary, intelligence, and data." actions={<ThemeModeSelector />} />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Settings sections" sx={{ mb: 4 }}>
        <Tab value="general" label="General" />
        <Tab value="trading" label="Trading" />
        <Tab value="tags" label="Tags" />
        <Tab value="ai" label="AI" />
        <Tab value="data" label="Data" />
      </Tabs>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {toast && <Alert severity="success" onClose={() => setToast(null)} sx={{ mb: 2 }}>{toast}</Alert>}

      {tab === 'general' && <GeneralTab settings={settings} onSave={handleSave} saving={saving} accounts={accounts} />}
      {tab === 'trading' && <TradingTab settings={settings} onSave={handleSave} saving={saving} strategies={strategies} />}
      {tab === 'tags' && <TagsTab />}
      {tab === 'ai' && (
        <Panel sx={{ maxWidth: 620 }}>
          <SectionHeader title="Tortoise AI settings" description="Provider controls remain beside the AI experience so changes can be evaluated immediately." />
          <Typography variant="body2" sx={{ mb: 2 }}>
            AI provider, model, and temperature settings live on the AI Trading Partner page itself, since that's
            where you can immediately see the effect of a change.
          </Typography>
          <Button component={RouterLink} to="/ai-partner" variant="outlined" size="small" endIcon={<OpenInNewIcon fontSize="small" />}>
            Go to Tortoise AI settings
          </Button>
        </Panel>
      )}
      {tab === 'data' && <DataTab />}
    </Box>
  );
}
