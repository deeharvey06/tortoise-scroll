import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { format, subDays } from 'date-fns';

import * as agentsApi from '../../services/agentsService';
import * as tradeApi from '../../services/tradeService';
import { useFilterParams } from '../../store/useFilterStore';
import { EmptyState, Panel, SectionHeader, StatusBadge } from '../../components/ui';

const CONDITION_FIELDS = ['setup', 'session', 'direction', 'symbol', 'assetType', 'followedPlan', 'rMultiple', 'netPnL', 'holdingTimeSeconds'];
const OPERATORS = ['equals', 'contains', 'gt', 'gte', 'lt', 'lte'];

function FindingsList({ findings }) {
  if (!findings || findings.length === 0) return <EmptyState compact title='No findings' description='The current data and filters produced no deterministic findings.' />;
  return (
    <Box component="ul" sx={{ pl: 2, m: 0 }}>
      {findings.map((f, i) => (
        <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>
          {f}
        </Typography>
      ))}
    </Box>
  );
}

function NarrativeOrList({ result }) {
  if (!result) return null;
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Panel>
        <SectionHeader eyebrow='Data / evidence' title='Deterministic findings' description='Computed from the existing trading data before any AI interpretation.' />
        <FindingsList findings={result.findings} />
      </Panel>
      {result.narrative && (
        <Panel sx={{ bgcolor: 'action.hover' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><Typography variant='overline' color='primary.main'>AI interpretation</Typography><StatusBadge label='Tortoise Insight' tone='info' /></Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {result.narrative}
          </Typography>
        </Panel>
      )}
    </Box>
  );
}

// --- Agent 1: Auto Tagger ---

function AutoTaggerAgent() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', autoApply: false, conditions: [{ field: 'setup', operator: 'equals', value: '' }], tagsToApply: '' });

  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await agentsApi.fetchTaggingRules());
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ name: '', autoApply: false, conditions: [{ field: 'setup', operator: 'equals', value: '' }], tagsToApply: '' });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    try {
      await agentsApi.createTaggingRule({
        name: form.name,
        autoApply: form.autoApply,
        conditions: form.conditions,
        tagsToApply: form.tagsToApply.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const deleteRule = async (id) => {
    await agentsApi.deleteTaggingRule(id);
    load();
  };

  const runOnRange = async () => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const { items } = await tradeApi.fetchTrades({
        dateFrom: new Date(`${dateFrom}T00:00:00.000Z`).toISOString(),
        dateTo: new Date(`${dateTo}T23:59:59.999Z`).toISOString(),
        limit: 500,
      });
      if (items.length === 0) {
        setRunResult({ applied: [], suggestions: [], note: 'No trades found in that date range.' });
        return;
      }
      const result = await agentsApi.runAutoTagger(items.map((t) => t._id));
      setRunResult(result);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setRunning(false);
    }
  };

  const approve = async (tradeId, tags) => {
    await agentsApi.approveTagSuggestion(tradeId, tags);
    setRunResult((r) => ({ ...r, suggestions: r.suggestions.filter((s) => s.tradeId !== tradeId) }));
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define rules (e.g. "setup equals Breakout AND R ≥ 2 → tag High-Quality-Breakout"). Rules with auto-apply on
        write tags immediately when run; others produce suggestions you approve individually.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">Rules</Typography>
        <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={openCreate}>
          New rule
        </Button>
      </Box>
      {loading ? (
        <CircularProgress size={18} />
      ) : rules.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No rules yet.
        </Typography>
      ) : (
        rules.map((r) => (
          <Paper key={r._id} variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {r.name} {r.autoApply && <Chip label="auto-apply" size="small" sx={{ ml: 1 }} />}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {r.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')} → {r.tagsToApply.join(', ')}
              </Typography>
            </Box>
            <IconButton size="small" aria-label="Delete tagging rule" onClick={() => deleteRule(r._id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Paper>
        ))
      )}

      <Divider2 />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Run against a date range
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button size="small" variant="contained" onClick={runOnRange} disabled={running}>
          {running ? <CircularProgress size={16} /> : 'Run'}
        </Button>
      </Box>

      {runResult && (
        <Box>
          {runResult.note && <Alert severity="info" sx={{ mb: 1 }}>{runResult.note}</Alert>}
          {runResult.applied?.length > 0 && (
            <Alert severity="success" sx={{ mb: 1 }}>
              Auto-applied tags to {runResult.applied.length} trade(s).
            </Alert>
          )}
          {runResult.suggestions?.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {runResult.suggestions.length} suggestion(s) awaiting approval:
              </Typography>
              {runResult.suggestions.map((s) => (
                <Paper key={s.tradeId} variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">
                    {s.symbol}: {s.matches.map((m) => m.tags.join(', ')).join(' | ')}
                  </Typography>
                  <Button size="small" onClick={() => approve(s.tradeId, s.matches.flatMap((m) => m.tags))}>
                    Approve
                  </Button>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New tagging rule</DialogTitle>
        <DialogContent dividers>
          <TextField label="Rule name" fullWidth size="small" sx={{ mb: 2 }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          {form.conditions.map((c, i) => (
            <Grid container spacing={1} key={i} sx={{ mb: 1 }}>
              <Grid item xs={4}>
                <TextField select size="small" fullWidth label="Field" value={c.field} onChange={(e) => {
                  const conditions = [...form.conditions]; conditions[i] = { ...c, field: e.target.value }; setForm((f) => ({ ...f, conditions }));
                }}>
                  {CONDITION_FIELDS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField select size="small" fullWidth label="Operator" value={c.operator} onChange={(e) => {
                  const conditions = [...form.conditions]; conditions[i] = { ...c, operator: e.target.value }; setForm((f) => ({ ...f, conditions }));
                }}>
                  {OPERATORS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={4}>
                <TextField size="small" fullWidth label="Value" value={c.value} onChange={(e) => {
                  const conditions = [...form.conditions]; conditions[i] = { ...c, value: e.target.value }; setForm((f) => ({ ...f, conditions }));
                }} />
              </Grid>
            </Grid>
          ))}
          <Button size="small" onClick={() => setForm((f) => ({ ...f, conditions: [...f.conditions, { field: 'setup', operator: 'equals', value: '' }] }))}>
            + Add condition
          </Button>
          <TextField
            label="Tags to apply (comma separated)"
            fullWidth
            size="small"
            sx={{ mt: 2, mb: 1 }}
            value={form.tagsToApply}
            onChange={(e) => setForm((f) => ({ ...f, tagsToApply: e.target.value }))}
          />
          <FormControlLabel
            control={<Switch checked={form.autoApply} onChange={(e) => setForm((f) => ({ ...f, autoApply: e.target.checked }))} />}
            label="Auto-apply (skip approval step)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveRule} disabled={!form.name}>
            Create rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Divider2() {
  return <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 2 }} />;
}

// --- Agent 2: Session Review ---

function SessionReviewAgent() {
  const params = useFilterParams();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await agentsApi.fetchSessionReview(date, params));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField type="date" size="small" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant="contained" size="small" onClick={run} disabled={loading}>
          {loading ? <CircularProgress size={16} /> : 'Generate review'}
        </Button>
      </Box>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {result && <NarrativeOrList result={result} />}
    </Box>
  );
}

// --- Agent 3: Pre-Market Briefing ---

function PreMarketAgent() {
  const params = useFilterParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await agentsApi.fetchPreMarketBriefing(params));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Button variant="contained" size="small" onClick={run} disabled={loading} sx={{ mb: 2 }}>
        {loading ? <CircularProgress size={16} /> : 'Generate briefing'}
      </Button>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {result && <NarrativeOrList result={result} />}
    </Box>
  );
}

// --- Agent 4: Risk Monitor ---

function RiskMonitorAgent() {
  const { accountId } = useFilterParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await agentsApi.fetchRiskAlert(accountId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Button variant="contained" size="small" onClick={run} disabled={loading} sx={{ mb: 2 }}>
        {loading ? <CircularProgress size={16} /> : 'Check risk now'}
      </Button>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {result && <NarrativeOrList result={result} />}
    </Box>
  );
}

// --- Agent 5: Performance Patterns ---

function PerformancePatternsAgent() {
  const params = useFilterParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await agentsApi.fetchPerformancePatterns(params));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Button variant="contained" size="small" onClick={run} disabled={loading} sx={{ mb: 2 }}>
        {loading ? <CircularProgress size={16} /> : 'Analyze patterns'}
      </Button>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {result && <NarrativeOrList result={result} />}
    </Box>
  );
}

export default function AgentsPanel() {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Every research tool below computes its findings deterministically from your trade data first. If AI is configured
        (see the gear icon), the findings are rewritten as prose; otherwise you see the same findings as a plain
        list. Either way, no agent invents a number that isn't in your data.
      </Alert>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Auto Trade Tagger</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <AutoTaggerAgent />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Session Review</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <SessionReviewAgent />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Pre-Market Briefing</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <PreMarketAgent />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Risk Monitor</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <RiskMonitorAgent />
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Performance Patterns</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <PerformancePatternsAgent />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
