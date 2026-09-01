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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
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

import * as playbookApi from '../../services/playbookService';
import * as tradeApi from '../../services/tradeService';
import KpiCard from '../../components/KpiCard';
import PageHeader from '../../components/PageHeader';
import { ConfirmationDialog, EmptyState, ErrorState, LoadingState, Panel, ProfitLossValue, RMultiple, SectionHeader, StatusBadge, TradeDirection } from '../../components/ui';

const FIELDS = [
  ['setupName', 'Setup name', false],
  ['description', 'Description', true],
  ['idealConditions', 'Ideal conditions', true],
  ['entryCriteria', 'Entry criteria', true],
  ['confirmation', 'Confirmation', true],
  ['invalidation', 'Invalidation', true],
  ['stopPlacement', 'Stop placement', true],
  ['target', 'Target', true],
  ['managementRules', 'Management rules', true],
  ['examples', 'Examples', true],
  ['counterexamples', 'Counterexamples', true],
];

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export default function PlaybooksPage() {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [performance, setPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [checklistState, setChecklistState] = useState({});
  const [associatedTrades, setAssociatedTrades] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await playbookApi.fetchPlaybooks();
      setPlaybooks(data);
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
    setChecklistState({});
    Promise.all([
      playbookApi.fetchPlaybookPerformance(selectedId),
      tradeApi.fetchTrades({ playbook: selectedId, limit: 8, sortBy: 'entryTime', sortDir: 'desc' }),
    ])
      .then(([metrics, trades]) => { setPerformance(metrics); setAssociatedTrades(trades.items); })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setPerfLoading(false));
  }, [selectedId]);

  const selected = playbooks.find((p) => p._id === selectedId);

  const openCreate = () => {
    setEditing(null);
    setForm({
      setupName: '',
      description: '',
      idealConditions: '',
      entryCriteria: '',
      confirmation: '',
      invalidation: '',
      stopPlacement: '',
      target: '',
      managementRules: '',
      examples: '',
      counterexamples: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...p });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await playbookApi.updatePlaybook(editing._id, form);
      } else {
        const created = await playbookApi.createPlaybook(form);
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
      await playbookApi.deletePlaybook(deleteTarget._id);
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
      await playbookApi.uploadPlaybookImage(selectedId, file);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleImageDelete = async (imageId) => {
    try {
      await playbookApi.deletePlaybookImage(selectedId, imageId);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const checkedCount = Object.values(checklistState).filter(Boolean).length;

  return (
    <Box>
      <PageHeader eyebrow='Pattern library' title='Playbooks' description='Your collection of repeatable patterns—defined clearly, checked before execution, and validated by recorded trades.' actions={<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New playbook
        </Button>} />

      {error && <ErrorState compact message={error} onClose={() => setError(null)} sx={{ mb: 4 }} />}

      {loading ? (
        <LoadingState label='Loading playbooks…' skeletonRows={5} />
      ) : playbooks.length === 0 ? (
        <EmptyState title='No playbooks yet' description='Define your first setup and turn it into a repeatable execution process.' action={<Button variant='contained' onClick={openCreate}>New playbook</Button>} />
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Panel padding={1.5} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
              <Typography variant='overline' color='text.secondary' sx={{ px: 1.5 }}>Validated patterns</Typography>
              <List dense>
                {playbooks.map((p) => (
                  <ListItemButton key={p._id} selected={p._id === selectedId} onClick={() => setSelectedId(p._id)}>
                    <ListItemText primary={p.setupName} primaryTypographyProps={{ fontWeight: p._id === selectedId ? 700 : 500 }} />
                  </ListItemButton>
                ))}
              </List>
            </Panel>
          </Grid>

          <Grid item xs={12} md={9}>
            {selected && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 4 }}>
                  <Box><Typography variant="h5">{selected.setupName}</Typography><StatusBadge label={selected.isActive === false ? 'Inactive' : 'Active'} tone={selected.isActive === false ? 'neutral' : 'positive'} sx={{ mt: 1 }} /></Box>
                  <Box>
                    <IconButton size="small" aria-label="Edit playbook" onClick={() => openEdit(selected)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete playbook" onClick={() => setDeleteTarget(selected)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <SectionHeader eyebrow='Performance' title='Pattern evidence' description='Results calculated from trades assigned to this playbook.' />
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
                  </Grid>
                ) : null}

                <Grid container spacing={3} sx={{ mb: 3 }}>
                  <Grid item xs={12} lg={8}>
                    <Panel sx={{ mb: 3 }}><SectionHeader eyebrow='Definition' title='Pattern definition' /><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{selected.description || 'No description documented.'}</Typography>{selected.idealConditions && <Box sx={{ mt: 3 }}><Typography variant='caption' color='text.secondary'>Ideal market conditions</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{selected.idealConditions}</Typography></Box>}</Panel>

                    <Panel sx={{ mb: 3 }}><SectionHeader eyebrow='Rules' title='Execution criteria' /><Grid container spacing={3}>{[['entryCriteria','Entry criteria'],['confirmation','Confirmation'],['invalidation','Invalidation'],['stopPlacement','Stop placement'],['target','Exit target'],['managementRules','Management rules']].map(([key,label]) => <Grid item xs={12} sm={6} key={key}><Typography variant='caption' color='text.secondary'>{label}</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{selected[key] || 'Not documented'}</Typography></Grid>)}</Grid></Panel>

                    {(selected.examples || selected.counterexamples) && <Panel sx={{ mb: 3 }}><SectionHeader eyebrow='Evidence' title='Examples and counterexamples' /><Grid container spacing={3}><Grid item xs={12} sm={6}><Typography variant='caption' color='text.secondary'>Valid examples</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{selected.examples || '—'}</Typography></Grid><Grid item xs={12} sm={6}><Typography variant='caption' color='text.secondary'>Counterexamples</Typography><Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{selected.counterexamples || '—'}</Typography></Grid></Grid></Panel>}

                    <Panel>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Evidence screenshots
                        </Typography>
                        <Button size="small" component="label" startIcon={<AddPhotoAlternateIcon fontSize="small" />}>
                          Upload
                          <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                        </Button>
                      </Box>
                      {(selected.screenshots || []).length === 0 ? (
                        <EmptyState compact title='No evidence screenshots' description='Upload strong examples or counterexamples for this pattern.' />
                      ) : (
                        <Grid container spacing={2}>
                          {selected.screenshots.map((shot) => (
                            <Grid item xs={12} sm={6} key={shot._id}>
                              <Box sx={{ overflow: 'hidden', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                                <Box component="img" src={shot.url} alt={shot.caption || `${selected.setupName} evidence`} sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
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
                  </Grid>

                  <Grid item xs={12} lg={4}>
                    <Panel sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
                      <Typography variant="overline" color="text.secondary">
                        Pre-trade checklist ({checkedCount}/{(selected.checklist || []).length})
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Run through this before taking the trade — it resets each time you switch playbooks.
                      </Typography>
                      {(selected.checklist || []).length ? (selected.checklist || []).map((item, i) => (
                        <FormControlLabel
                          key={i}
                          sx={{ display: 'flex' }}
                          control={
                            <Checkbox
                              size="small"
                              checked={!!checklistState[i]}
                              onChange={(e) => setChecklistState((s) => ({ ...s, [i]: e.target.checked }))}
                            />
                          }
                          label={<Typography variant="body2">{item}</Typography>}
                        />
                      )) : <EmptyState compact title='No checklist configured' description='This playbook has no checklist items.' />}
                    </Panel>
                  </Grid>
                </Grid>

                <Panel padding={0}><Box sx={{ p: 3 }}><SectionHeader eyebrow='Evidence' title='Associated trades' description={`The ${Math.min(associatedTrades.length, 8)} most recent trades assigned to this playbook.`} sx={{ mb: 0 }} /></Box>{associatedTrades.length ? <TableContainer><Table size='small'><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Symbol</TableCell><TableCell>Direction</TableCell><TableCell align='right'>Net P&L</TableCell><TableCell align='right'>R</TableCell></TableRow></TableHead><TableBody>{associatedTrades.map((trade) => <TableRow key={trade._id} hover onClick={() => navigate(`/trades/${trade._id}`)} sx={{ cursor: 'pointer' }}><TableCell className='mono-data'>{new Date(trade.entryTime).toLocaleDateString()}</TableCell><TableCell sx={{ fontWeight: 700 }}>{trade.symbol}</TableCell><TableCell><TradeDirection direction={trade.direction} /></TableCell><TableCell align='right'><ProfitLossValue value={trade.netPnL} /></TableCell><TableCell align='right'><RMultiple value={trade.rMultiple} /></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <EmptyState compact title='No associated trades' description='Assign trades to this playbook from the Trade form to validate the pattern.' />}</Panel>
              </>
            )}
          </Grid>
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit playbook' : 'New playbook'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            {FIELDS.map(([key, label, multiline]) => (
              <Grid item xs={12} key={key}>
                <TextField
                  label={label}
                  fullWidth
                  size="small"
                  required={key === 'setupName'}
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
          <Button variant="contained" onClick={handleSave} disabled={!form.setupName}>
            {editing ? 'Save changes' : 'Create playbook'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete playbook?"
        description={`This permanently deletes "${deleteTarget?.setupName || ''}". If trades are assigned to it, deletion will be blocked until they are reassigned.`}
        confirmLabel="Delete playbook"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
