import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import AddPhotoIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, FormControlLabel,
  Grid, IconButton, Rating, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';

import PageHeader from '../../components/PageHeader';
import {
  EmptyState, ErrorState, LoadingState, MetricCard, Panel, ProfitLossValue,
  SectionHeader, StatusBadge, Tag, TradeDirection,
} from '../../components/ui';
import * as tagApi from '../../services/tagService';
import * as tradeApi from '../../services/tradeService';

const MISTAKES = ['Early Entry', 'Late Entry', 'Overtrading', 'FOMO', 'Oversized', 'Poor Exit', 'Failed Follow-through'];
const EMOTIONS = ['Calm', 'Confident', 'Fear', 'Frustrated', 'Revenge', 'FOMO'];

const money = (value) => value == null ? '—' : `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;
function duration(seconds) {
  if (seconds == null) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
function DataPoint({ label, children }) {
  return <Box><Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.5 }}>{label}</Typography><Box className='mono-data' sx={{ minHeight: 24, fontWeight: 600 }}>{children ?? '—'}</Box></Box>;
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
  const [journal, setJournal] = useState({ notes: '', entryReason: '', exitReason: '', marketCondition: '', mistake: [], emotion: [], confidence: null, followedPlan: null, followedRules: null, missedOpportunity: false, tags: [] });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const value = await tradeApi.fetchTrade(id);
      setTrade(value);
      setJournal({ notes: value.notes || '', entryReason: value.entryReason || '', exitReason: value.exitReason || '', marketCondition: value.marketCondition || '', mistake: value.mistake || [], emotion: value.emotion || [], confidence: value.confidence || null, followedPlan: value.followedPlan, followedRules: value.followedRules, missedOpportunity: !!value.missedOpportunity, tags: value.tags || [] });
    } catch (err) { setError(err.response?.data?.error?.message || err.message || 'Failed to load trade'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
    tagApi.fetchTags().then((tags) => setAllTags(tags.map((tag) => tag.name))).catch(() => {});
  }, [load]);

  const updateJournal = (key, value) => setJournal((current) => ({ ...current, [key]: value }));
  const saveJournal = async () => {
    setSaving(true); setError(null);
    try { setTrade(await tradeApi.updateTrade(id, journal)); setToast('Journal saved'); }
    catch (err) { setError(err.response?.data?.error?.message || err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };
  const upload = async (file) => {
    if (!file) return;
    try { setTrade(await tradeApi.uploadScreenshot(id, file)); }
    catch (err) { setError(err.response?.data?.error?.message || err.message || 'Failed to upload screenshot'); }
  };
  const caption = async (shotId, value) => {
    try { setTrade(await tradeApi.updateScreenshotCaption(id, shotId, value)); }
    catch (err) { setError(err.response?.data?.error?.message || err.message || 'Failed to update caption'); }
  };
  const removeShot = async (shotId) => {
    try { setTrade(await tradeApi.deleteScreenshot(id, shotId)); }
    catch (err) { setError(err.response?.data?.error?.message || err.message || 'Failed to delete screenshot'); }
  };

  if (loading) return <LoadingState label='Loading trade record…' />;
  if (error && !trade) return <ErrorState message={error} onRetry={load} />;
  if (!trade) return null;

  return <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
    <PageHeader eyebrow='Trade record' title={trade.symbol} description={`${format(new Date(trade.entryTime), 'PPP · p')}${trade.exitTime ? ` → ${format(new Date(trade.exitTime), 'PPP · p')}` : ' · Open position'}`} actions={<Box sx={{ display: 'flex', gap: 1 }}><TradeDirection direction={trade.direction} /><Button variant='outlined' size='small' startIcon={<ArrowBackIcon />} onClick={() => navigate('/trades')}>All trades</Button></Box>} />
    {error && <ErrorState compact message={error} onClose={() => setError(null)} sx={{ mb: 4 }} />}
    {toast && <Alert severity='success' onClose={() => setToast(null)} sx={{ mb: 4 }}>{toast}</Alert>}

    <SectionHeader eyebrow='Summary' title='Trade outcome' description='The result, risk, and time committed to this trade.' />
    <Grid container spacing={2} sx={{ mb: 5 }}>
      <Grid item xs={12} sm={6} md={3}><MetricCard label='Net P&L' value={money(trade.netPnL)} tone={trade.netPnL > 0 ? 'positive' : trade.netPnL < 0 ? 'negative' : undefined} /></Grid>
      <Grid item xs={12} sm={6} md={3}><MetricCard label='R multiple' value={trade.rMultiple == null ? '—' : `${trade.rMultiple.toFixed(2)}R`} tone={trade.rMultiple > 0 ? 'positive' : trade.rMultiple < 0 ? 'negative' : undefined} /></Grid>
      <Grid item xs={12} sm={6} md={3}><MetricCard label='Risk' value={money(trade.riskAmount)} /></Grid>
      <Grid item xs={12} sm={6} md={3}><MetricCard label='Duration' value={duration(trade.holdingTimeSeconds)} /></Grid>
    </Grid>

    <Grid container spacing={3} sx={{ mb: 5 }}>
      <Grid item xs={12} lg={8}><Panel>
        <SectionHeader eyebrow='Execution' title='Order and fill record' />
        <Grid container spacing={3}>
          <Grid item xs={6} sm={3}><DataPoint label='Quantity'>{trade.quantity}</DataPoint></Grid><Grid item xs={6} sm={3}><DataPoint label='Entry'>{trade.entryPrice?.toFixed(2)}</DataPoint></Grid>
          <Grid item xs={6} sm={3}><DataPoint label='Exit'>{trade.exitPrice != null ? trade.exitPrice.toFixed(2) : 'Open'}</DataPoint></Grid><Grid item xs={6} sm={3}><DataPoint label='Stop loss'>{trade.stopLoss ?? '—'}</DataPoint></Grid>
          <Grid item xs={6} sm={3}><DataPoint label='Gross P&L'><ProfitLossValue value={trade.grossPnL} /></DataPoint></Grid><Grid item xs={6} sm={3}><DataPoint label='Fees'>{money(trade.fees || 0)}</DataPoint></Grid>
          <Grid item xs={6} sm={3}><DataPoint label='Commission'>{money(trade.commission || 0)}</DataPoint></Grid><Grid item xs={6} sm={3}><DataPoint label='Take profit'>{trade.takeProfit ?? '—'}</DataPoint></Grid>
        </Grid>
        {trade.executions?.length ? <TableContainer sx={{ mt: 3, border: 1, borderColor: 'divider', borderRadius: 1 }}><Table size='small' aria-label='Trade executions'><TableHead><TableRow><TableCell>Time</TableCell><TableCell>Side</TableCell><TableCell align='right'>Qty</TableCell><TableCell align='right'>Price</TableCell><TableCell align='right'>Fees</TableCell><TableCell align='right'>Commission</TableCell></TableRow></TableHead><TableBody>{trade.executions.map((execution, index) => <TableRow key={`${execution.time}-${index}`}><TableCell className='mono-data' sx={{ whiteSpace: 'nowrap' }}>{format(new Date(execution.time), 'MMM d, yyyy HH:mm:ss')}</TableCell><TableCell><StatusBadge label={execution.side} tone={execution.side === 'buy' ? 'positive' : 'negative'} /></TableCell><TableCell align='right' className='mono-data'>{execution.quantity}</TableCell><TableCell align='right' className='mono-data'>{execution.price?.toFixed(2)}</TableCell><TableCell align='right' className='mono-data'>{money(execution.fees || 0)}</TableCell><TableCell align='right' className='mono-data'>{money(execution.commission || 0)}</TableCell></TableRow>)}</TableBody></Table></TableContainer> : <Typography variant='body2' color='text.secondary' sx={{ mt: 3 }}>Single entry / single exit — no individual fills recorded.</Typography>}
      </Panel></Grid>
      <Grid item xs={12} lg={4}><Panel sx={{ height: '100%' }}><SectionHeader eyebrow='Context' title='Trade classification' /><Grid container spacing={3}><Grid item xs={6}><DataPoint label='Setup'>{trade.setup || '—'}</DataPoint></Grid><Grid item xs={6}><DataPoint label='Session'>{trade.session || '—'}</DataPoint></Grid><Grid item xs={6}><DataPoint label='Asset type'>{trade.assetType || '—'}</DataPoint></Grid><Grid item xs={6}><DataPoint label='Timeframe'>{trade.timeframe || '—'}</DataPoint></Grid><Grid item xs={12}><DataPoint label='Market'>{trade.market || '—'}</DataPoint></Grid><Grid item xs={12}><Typography variant='caption' color='text.secondary'>Tags</Typography><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>{trade.tags?.length ? trade.tags.map((tag) => <Tag key={tag} label={tag} />) : '—'}</Box></Grid></Grid></Panel></Grid>
    </Grid>

    <Grid container spacing={3} sx={{ mb: 5 }}>
      <Grid item xs={12} lg={7}><Panel sx={{ height: '100%' }}><SectionHeader eyebrow='Journal' title='Decision record' description='Capture the reasoning and market conditions surrounding the trade.' /><Grid container spacing={2}><Grid item xs={12} sm={6}><TextField label='Entry reasoning' fullWidth multiline minRows={3} value={journal.entryReason} onChange={(e) => updateJournal('entryReason', e.target.value)} /></Grid><Grid item xs={12} sm={6}><TextField label='Exit reasoning' fullWidth multiline minRows={3} value={journal.exitReason} onChange={(e) => updateJournal('exitReason', e.target.value)} /></Grid><Grid item xs={12}><TextField label='Market condition' fullWidth value={journal.marketCondition} onChange={(e) => updateJournal('marketCondition', e.target.value)} /></Grid><Grid item xs={12}><TextField label='Notes' fullWidth multiline minRows={4} value={journal.notes} onChange={(e) => updateJournal('notes', e.target.value)} /></Grid><Grid item xs={12}><Autocomplete multiple freeSolo options={allTags} value={journal.tags} onChange={(e, value) => updateJournal('tags', value)} renderTags={(value, getTagProps) => value.map((option, index) => <Tag key={option} label={option} {...getTagProps({ index })} />)} renderInput={(params) => <TextField {...params} label='Tags' placeholder='Add tag' />} /></Grid></Grid></Panel></Grid>
      <Grid item xs={12} lg={5}><Panel sx={{ height: '100%' }}><SectionHeader eyebrow='Process review' title='Discipline and self-assessment' /><Grid container spacing={2}><Grid item xs={12}><Autocomplete multiple freeSolo options={MISTAKES} value={journal.mistake} onChange={(e, value) => updateJournal('mistake', value)} renderInput={(params) => <TextField {...params} label='Mistakes' placeholder='Add mistake' />} /></Grid><Grid item xs={12}><Autocomplete multiple freeSolo options={EMOTIONS} value={journal.emotion} onChange={(e, value) => updateJournal('emotion', value)} renderInput={(params) => <TextField {...params} label='Emotions' placeholder='Add emotion' />} /></Grid><Grid item xs={12}><Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>Confidence</Typography><Rating value={journal.confidence || 0} onChange={(e, value) => updateJournal('confidence', value)} /></Grid><Grid item xs={12}><Box sx={{ display: 'grid' }}><FormControlLabel control={<Checkbox checked={!!journal.followedPlan} onChange={(e) => updateJournal('followedPlan', e.target.checked)} />} label='Followed plan' /><FormControlLabel control={<Checkbox checked={!!journal.followedRules} onChange={(e) => updateJournal('followedRules', e.target.checked)} />} label='Followed rules' /><FormControlLabel control={<Checkbox checked={!!journal.missedOpportunity} onChange={(e) => updateJournal('missedOpportunity', e.target.checked)} />} label='Missed opportunity' /></Box></Grid><Grid item xs={12}><Button fullWidth variant='contained' onClick={saveJournal} disabled={saving}>{saving ? <CircularProgress size={18} /> : 'Save journal'}</Button></Grid></Grid></Panel></Grid>
    </Grid>

    <Panel><SectionHeader eyebrow='Screenshots' title='Visual record' description='Charts and execution evidence attached to this trade.' actions={<Button size='small' component='label' startIcon={<AddPhotoIcon />}>Upload<input type='file' hidden accept='image/*' onChange={(e) => upload(e.target.files?.[0])} /></Button>} />{!trade.screenshots?.length ? <EmptyState compact title='No screenshots yet' description='Upload a chart or execution screenshot to preserve the visual context.' /> : <Grid container spacing={2}>{trade.screenshots.map((shot) => <Grid item xs={12} sm={6} md={4} key={shot._id}><Box sx={{ overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default' }}><Box component='img' src={shot.url} alt={shot.caption || 'Trade screenshot'} sx={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block', borderBottom: 1, borderColor: 'divider' }} /><Box sx={{ p: 1.5, display: 'flex', gap: 1 }}><TextField size='small' fullWidth placeholder='Caption' defaultValue={shot.caption} onBlur={(e) => caption(shot._id, e.target.value)} /><IconButton size='small' aria-label='Delete screenshot' onClick={() => removeShot(shot._id)}><DeleteIcon fontSize='small' /></IconButton></Box></Box></Grid>)}</Grid>}</Panel>
  </Box>;
}
