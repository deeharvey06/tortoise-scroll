import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Rating from '@mui/material/Rating';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined';
import { format } from 'date-fns';

import * as tradeApi from '../../services/tradeService';
import * as tagApi from '../../services/tagService';

const MISTAKE_OPTIONS = [
  'Early Entry',
  'Late Entry',
  'Overtrading',
  'FOMO',
  'Oversized',
  'Poor Exit',
  'Failed Follow-through',
];
const EMOTION_OPTIONS = ['Calm', 'Confident', 'Fear', 'Frustrated', 'Revenge', 'FOMO'];

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function pnlColor(value) {
  if (value === null || value === undefined) return 'text.primary';
  return value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary';
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SummaryStat({ label, value, color }) {
  return (
    <Grid item xs={6} sm={3}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body1" className="mono-data" sx={{ fontWeight: 600, color: color || 'text.primary' }}>
        {value}
      </Typography>
    </Grid>
  );
}

export default function TradeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trade, setTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [allTags, setAllTags] = useState([]);

  const [journal, setJournal] = useState({
    notes: '',
    entryReason: '',
    exitReason: '',
    marketCondition: '',
    mistake: [],
    emotion: [],
    confidence: null,
    followedPlan: null,
    followedRules: null,
    missedOpportunity: false,
    tags: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await tradeApi.fetchTrade(id);
      setTrade(t);
      setJournal({
        notes: t.notes || '',
        entryReason: t.entryReason || '',
        exitReason: t.exitReason || '',
        marketCondition: t.marketCondition || '',
        mistake: t.mistake || [],
        emotion: t.emotion || [],
        confidence: t.confidence || null,
        followedPlan: t.followedPlan,
        followedRules: t.followedRules,
        missedOpportunity: !!t.missedOpportunity,
        tags: t.tags || [],
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load trade');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    tagApi
      .fetchTags()
      .then((tags) => setAllTags(tags.map((t) => t.name)))
      .catch(() => {});
  }, [load]);

  const saveJournal = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await tradeApi.updateTrade(id, journal);
      setTrade(updated);
      setToast('Saved');
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleScreenshotUpload = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const updated = await tradeApi.uploadScreenshot(id, file);
      setTrade(updated);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to upload screenshot');
    }
  };

  const handleCaptionBlur = async (screenshotId, caption) => {
    try {
      const updated = await tradeApi.updateScreenshotCaption(id, screenshotId, caption);
      setTrade(updated);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to update caption');
    }
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    try {
      const updated = await tradeApi.deleteScreenshot(id, screenshotId);
      setTrade(updated);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to delete screenshot');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error && !trade) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!trade) return null;

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/trades" underline="hover" color="inherit">
          Trades
        </Link>
        <Typography color="text.primary">{trade.symbol}</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <IconButton size="small" aria-label="Back to trades" onClick={() => navigate('/trades')}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {trade.symbol}
        </Typography>
        <Chip
          size="small"
          label={trade.direction}
          color={trade.direction === 'long' ? 'success' : 'error'}
          variant="outlined"
        />
        <Typography variant="body2" color="text.secondary">
          {format(new Date(trade.entryTime), 'PPP p')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {toast && (
        <Alert severity="success" onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Summary
        </Typography>
        <Grid container spacing={2}>
          <SummaryStat label="Entry" value={trade.entryPrice?.toFixed(2)} />
          <SummaryStat label="Exit" value={trade.exitPrice !== null ? trade.exitPrice?.toFixed(2) : 'Open'} />
          <SummaryStat label="Net P&L" value={formatCurrency(trade.netPnL)} color={pnlColor(trade.netPnL)} />
          <SummaryStat
            label="R multiple"
            value={trade.rMultiple !== null && trade.rMultiple !== undefined ? `${trade.rMultiple.toFixed(2)}R` : '—'}
            color={pnlColor(trade.rMultiple)}
          />
          <SummaryStat label="Duration" value={formatDuration(trade.holdingTimeSeconds)} />
          <SummaryStat
            label="Risk ($)"
            value={trade.riskAmount !== null && trade.riskAmount !== undefined ? `$${trade.riskAmount}` : '—'}
          />
          <SummaryStat label="Quantity" value={trade.quantity} />
          <SummaryStat label="Setup" value={trade.setup || '—'} />
        </Grid>
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Execution
        </Typography>
        <Grid container spacing={2}>
          <SummaryStat label="Fees" value={`$${(trade.fees || 0).toFixed(2)}`} />
          <SummaryStat label="Commission" value={`$${(trade.commission || 0).toFixed(2)}`} />
          <SummaryStat label="Gross P&L" value={formatCurrency(trade.grossPnL)} color={pnlColor(trade.grossPnL)} />
          <SummaryStat label="Stop loss" value={trade.stopLoss ?? '—'} />
        </Grid>
        {trade.executions?.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {trade.executions.length} individual fill(s) — aggregate figures above are a weighted average of these.
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Single entry / single exit — no individual fills recorded for this trade.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Journal
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Entry reasoning"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={journal.entryReason}
              onChange={(e) => setJournal((j) => ({ ...j, entryReason: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Exit reasoning"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={journal.exitReason}
              onChange={(e) => setJournal((j) => ({ ...j, exitReason: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Market condition"
              fullWidth
              size="small"
              value={journal.marketCondition}
              onChange={(e) => setJournal((j) => ({ ...j, marketCondition: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple
              freeSolo
              size="small"
              options={MISTAKE_OPTIONS}
              value={journal.mistake}
              onChange={(e, val) => setJournal((j) => ({ ...j, mistake: val }))}
              renderInput={(params) => <TextField {...params} label="Mistakes" placeholder="Add mistake" />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple
              freeSolo
              size="small"
              options={EMOTION_OPTIONS}
              value={journal.emotion}
              onChange={(e, val) => setJournal((j) => ({ ...j, emotion: val }))}
              renderInput={(params) => <TextField {...params} label="Emotions" placeholder="Add emotion" />}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Confidence
              </Typography>
              <Rating value={journal.confidence || 0} onChange={(e, val) => setJournal((j) => ({ ...j, confidence: val }))} />
            </Box>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!journal.followedPlan}
                    onChange={(e) => setJournal((j) => ({ ...j, followedPlan: e.target.checked }))}
                  />
                }
                label="Followed plan"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!journal.followedRules}
                    onChange={(e) => setJournal((j) => ({ ...j, followedRules: e.target.checked }))}
                  />
                }
                label="Followed rules"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!journal.missedOpportunity}
                    onChange={(e) => setJournal((j) => ({ ...j, missedOpportunity: e.target.checked }))}
                  />
                }
                label="Missed opportunity"
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              fullWidth
              multiline
              minRows={3}
              size="small"
              value={journal.notes}
              onChange={(e) => setJournal((j) => ({ ...j, notes: e.target.value }))}
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              multiple
              freeSolo
              size="small"
              options={allTags}
              value={journal.tags}
              onChange={(e, val) => setJournal((j) => ({ ...j, tags: val }))}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => <Chip label={option} size="small" {...getTagProps({ index })} />)
              }
              renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tag" />}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={saveJournal} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Save journal'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Screenshots
          </Typography>
          <Button size="small" component="label" startIcon={<AddPhotoAlternateIcon fontSize="small" />}>
            Upload
            <input type="file" hidden accept="image/*" onChange={(e) => handleScreenshotUpload(e.target.files?.[0])} />
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {(!trade.screenshots || trade.screenshots.length === 0) && (
          <Typography variant="body2" color="text.secondary">
            No screenshots yet.
          </Typography>
        )}
        <Grid container spacing={2}>
          {(trade.screenshots || []).map((shot) => (
            <Grid item xs={12} sm={6} md={4} key={shot._id}>
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box
                  component="img"
                  src={shot.url}
                  alt={shot.caption || 'Trade screenshot'}
                  sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
                />
                <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Caption"
                    defaultValue={shot.caption}
                    onBlur={(e) => handleCaptionBlur(shot._id, e.target.value)}
                  />
                  <IconButton size="small" aria-label="Delete screenshot" onClick={() => handleDeleteScreenshot(shot._id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}
