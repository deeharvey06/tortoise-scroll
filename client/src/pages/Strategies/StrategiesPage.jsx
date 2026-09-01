import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import * as strategyApi from '../../services/strategyService';
import * as tradeApi from '../../services/tradeService';
import KpiCard from '../../components/KpiCard';
import PageHeader from '../../components/PageHeader';
import { ConfirmationDialog, EmptyState, ErrorState, LoadingState, Panel, ProfitLossValue, RMultiple, SectionHeader, StatusBadge, TradeDirection } from '../../components/ui';

const FIELDS = [
  ['name', 'Name', false],
  ['market', 'Market', false],
  ['timeframe', 'Timeframe', false],
  ['description', 'Description', true],
  ['entryRules', 'Entry rules', true],
  ['exitRules', 'Exit rules', true],
  ['stopRules', 'Stop rules', true],
  ['targetRules', 'Target rules', true],
  ['riskRules', 'Risk rules', true],
  ['notes', 'Notes', true],
];

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export default function StrategiesPage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [performance, setPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [associatedTrades, setAssociatedTrades] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await strategyApi.fetchStrategies();
      setStrategies(data);
      if (!selectedId && data.length) setSelectedId(data[0]._id);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setPerformance(null);
      setAssociatedTrades([]);
      return;
    }
    setPerfLoading(true);
    Promise.all([
      strategyApi.fetchStrategyPerformance(selectedId),
      tradeApi.fetchTrades({ strategy: selectedId, limit: 8, sortBy: 'entryTime', sortDir: 'desc' }),
    ])
      .then(([metrics, trades]) => { setPerformance(metrics); setAssociatedTrades(trades.items); })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setPerfLoading(false));
  }, [selectedId]);

  const selected = strategies.find((s) => s._id === selectedId);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', market: '', timeframe: '', description: '', entryRules: '', exitRules: '', stopRules: '', targetRules: '', riskRules: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...s });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await strategyApi.updateStrategy(editing._id, form);
      } else {
        const created = await strategyApi.createStrategy(form);
        setSelectedId(created._id);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await strategyApi.deleteStrategy(deleteTarget._id);
      setDeleteTarget(null);
      if (selectedId === deleteTarget._id) setSelectedId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file || !selectedId) return;
    try {
      await strategyApi.uploadStrategyImage(selectedId, file);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleImageDelete = async (imageId) => {
    try {
      await strategyApi.deleteStrategyImage(selectedId, imageId);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  return (
    <Box>
      <PageHeader eyebrow='Edge library' title='Strategies' description='Define how you trade, codify the rules, and validate each strategy against its recorded evidence.' actions={<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New strategy
        </Button>} />

      {error && <ErrorState compact message={error} onClose={() => setError(null)} sx={{ mb: 4 }} />}

      {loading ? (
        <LoadingState label='Loading strategies…' skeletonRows={5} />
      ) : strategies.length === 0 ? (
        <EmptyState title='No strategies yet' description='Create a strategy, document its rules, then assign trades to it from the Trade form.' action={<Button variant='contained' onClick={openCreate}>New strategy</Button>} />
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Panel padding={1.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
              <Typography variant='overline' color='text.secondary' sx={{ px: 1.5 }}>Strategy library</Typography>
              <List dense>
                {strategies.map((s) => (
                  <ListItemButton key={s._id} selected={s._id === selectedId} onClick={() => setSelectedId(s._id)}>
                    <ListItemText primary={s.name} secondary={[s.market, s.timeframe].filter(Boolean).join(' · ') || undefined} primaryTypographyProps={{ fontWeight: s._id === selectedId ? 700 : 500 }} />
                  </ListItemButton>
                ))}
              </List>
            </Panel>
          </Grid>

          <Grid item xs={12} md={9}>
            {selected && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 4 }}>
                  <Box><Typography variant="h5">{selected.name}</Typography><Box sx={{ display: 'flex', gap: 1, mt: 1 }}>{selected.market && <StatusBadge label={selected.market} />}{selected.timeframe && <StatusBadge label={selected.timeframe} tone='info' />}</Box></Box>
                  <Box>
                    <IconButton size="small" aria-label="Edit strategy" onClick={() => openEdit(selected)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete strategy" onClick={() => setDeleteTarget(selected)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <SectionHeader eyebrow='Performance' title='Validated results' description='Evidence calculated from trades assigned to this strategy.' />
                {perfLoading ? (
                  <LoadingState compact label='Calculating performance…' />
                ) : performance ? (
                  <Grid container spacing={1.5} sx={{ mb: 5 }}>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Net P&L" value={fmtMoney(performance.netPnL)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Win rate" value={performance.winRate} suffix="%" />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Profit factor" value={performance.profitFactor} />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Expectancy" value={fmtMoney(performance.expectancy)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Avg R" value={performance.avgR} suffix="R" />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Trades" value={performance.totalTrades} />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Avg winner" value={fmtMoney(performance.avgWin)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Avg loser" value={fmtMoney(performance.avgLoss)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={4} lg={2}>
                      <KpiCard label="Max drawdown" value={fmtMoney(performance.maxDrawdown)} colorByValue />
                    </Grid>
                  </Grid>
                ) : null}

                <Grid container spacing={3} sx={{ mb: 5 }}>
                  <Grid item xs={12} lg={5}><Panel sx={{ height: '100%' }}><SectionHeader eyebrow='Definition' title='Strategy thesis' />{selected.description ? <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{selected.description}</Typography> : <EmptyState compact title='Definition not documented' description='Edit this strategy to record its purpose and market context.' />}<Grid container spacing={2} sx={{ mt: 1 }}><Grid item xs={6}><Typography variant='caption' color='text.secondary'>Market</Typography><Typography variant='body2'>{selected.market || '—'}</Typography></Grid><Grid item xs={6}><Typography variant='caption' color='text.secondary'>Timeframe</Typography><Typography variant='body2'>{selected.timeframe || '—'}</Typography></Grid>{selected.notes && <Grid item xs={12}><Typography variant='caption' color='text.secondary'>Notes</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{selected.notes}</Typography></Grid>}</Grid></Panel></Grid>
                  <Grid item xs={12} lg={7}><Panel sx={{ height: '100%' }}><SectionHeader eyebrow='Rules' title='Execution framework' /><Grid container spacing={3}>{[['entryRules','Entry criteria'],['exitRules','Exit criteria'],['stopRules','Stop rules'],['targetRules','Target rules'],['riskRules','Risk rules']].map(([key,label]) => <Grid item xs={12} sm={6} key={key}><Typography variant='caption' color='text.secondary'>{label}</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{selected[key] || 'Not documented'}</Typography></Grid>)}</Grid></Panel></Grid>
                </Grid>

                <Panel sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <SectionHeader eyebrow='Evidence' title='Reference screenshots' description='Visual examples supporting the written strategy.' sx={{ mb: 0 }} />
                    <Button size="small" component="label" startIcon={<AddPhotoAlternateIcon fontSize="small" />}>
                      Upload
                      <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                    </Button>
                  </Box>
                  {(selected.screenshots || []).length === 0 ? (
                    <EmptyState compact title='No reference screenshots' description='Upload only examples that clarify or validate the strategy.' />
                  ) : (
                    <Grid container spacing={2}>
                      {selected.screenshots.map((shot) => (
                        <Grid item xs={12} sm={6} md={4} key={shot._id}>
                          <Box sx={{ overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                            <Box component="img" src={shot.url} alt={shot.caption || `${selected.name} reference`} sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                              <IconButton size="small" aria-label="Delete screenshot" onClick={() => handleImageDelete(shot._id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Panel>

                <Panel padding={0}><Box sx={{ p: 3 }}><SectionHeader eyebrow='Evidence' title='Associated trades' description={`The ${Math.min(associatedTrades.length, 8)} most recent trades assigned to this strategy.`} sx={{ mb: 0 }} /></Box>{associatedTrades.length ? <TableContainer><Table size='small'><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Symbol</TableCell><TableCell>Direction</TableCell><TableCell align='right'>Net P&L</TableCell><TableCell align='right'>R</TableCell></TableRow></TableHead><TableBody>{associatedTrades.map((trade) => <TableRow key={trade._id} hover onClick={() => navigate(`/trades/${trade._id}`)} sx={{ cursor: 'pointer' }}><TableCell className='mono-data'>{new Date(trade.entryTime).toLocaleDateString()}</TableCell><TableCell sx={{ fontWeight: 700 }}>{trade.symbol}</TableCell><TableCell><TradeDirection direction={trade.direction} /></TableCell><TableCell align='right'><ProfitLossValue value={trade.netPnL} /></TableCell><TableCell align='right'><RMultiple value={trade.rMultiple} /></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <EmptyState compact title='No associated trades' description='Assign trades to this strategy from the Trade form to build an evidence base.' />}</Panel>
              </>
            )}
          </Grid>
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit strategy' : 'New strategy'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {FIELDS.map(([key, label, multiline]) => (
              <Grid item xs={12} sm={key === 'market' || key === 'timeframe' ? 6 : 12} key={key}>
                <TextField
                  label={label}
                  fullWidth
                  size="small"
                  required={key === 'name'}
                  multiline={multiline}
                  minRows={multiline ? 2 : 1}
                  value={form[key] || ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>
            {editing ? 'Save changes' : 'Create strategy'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete strategy?"
        description={`This permanently deletes "${deleteTarget?.name || ''}". If trades are assigned to it, deletion will be blocked until they are reassigned.`}
        confirmLabel="Delete strategy"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
