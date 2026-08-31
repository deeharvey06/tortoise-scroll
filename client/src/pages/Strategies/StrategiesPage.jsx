import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
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
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';

import * as strategyApi from '../../services/strategyService';
import KpiCard from '../../components/KpiCard';

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
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [performance, setPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);

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
      return;
    }
    setPerfLoading(true);
    strategyApi
      .fetchStrategyPerformance(selectedId)
      .then(setPerformance)
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Strategies</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New strategy
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={26} />
        </Box>
      ) : strategies.length === 0 ? (
        <Alert severity="info">No strategies yet. Click "New strategy" to create one, then assign trades to it from the Trade form.</Alert>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper>
              <List dense>
                {strategies.map((s) => (
                  <ListItemButton key={s._id} selected={s._id === selectedId} onClick={() => setSelectedId(s._id)}>
                    <ListItemText primary={s.name} secondary={s.market || s.timeframe || undefined} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={9}>
            {selected && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6">{selected.name}</Typography>
                  <Box>
                    <IconButton size="small" aria-label="Edit strategy" onClick={() => openEdit(selected)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete strategy" onClick={() => setDeleteTarget(selected)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {perfLoading ? (
                  <CircularProgress size={20} sx={{ mb: 2 }} />
                ) : performance ? (
                  <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Net P&L" value={fmtMoney(performance.netPnL)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Win rate" value={performance.winRate} suffix="%" />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Profit factor" value={performance.profitFactor} />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Expectancy" value={fmtMoney(performance.expectancy)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Avg R" value={performance.avgR} suffix="R" />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Trades" value={performance.totalTrades} />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Avg winner" value={fmtMoney(performance.avgWin)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Avg loser" value={fmtMoney(performance.avgLoss)} colorByValue />
                    </Grid>
                    <Grid item xs={6} sm={3} md={2}>
                      <KpiCard label="Max drawdown" value={fmtMoney(performance.maxDrawdown)} colorByValue />
                    </Grid>
                  </Grid>
                ) : null}

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2}>
                    {FIELDS.filter(([key]) => key !== 'name' && selected[key]).map(([key, label]) => (
                      <Grid item xs={12} sm={key === 'market' || key === 'timeframe' ? 6 : 12} key={key}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {label}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {selected[key]}
                        </Typography>
                      </Grid>
                    ))}
                    {FIELDS.filter(([key]) => key !== 'name' && selected[key]).length === 0 && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          No rules documented yet — click the edit icon to add entry/exit/stop/target/risk rules.
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>

                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Reference screenshots
                    </Typography>
                    <Button size="small" component="label" startIcon={<AddPhotoAlternateIcon fontSize="small" />}>
                      Upload
                      <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                    </Button>
                  </Box>
                  {(selected.screenshots || []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No screenshots yet.
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {selected.screenshots.map((shot) => (
                        <Grid item xs={12} sm={6} md={4} key={shot._id}>
                          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                            <Box component="img" src={shot.url} sx={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                            <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
                              <IconButton size="small" aria-label="Delete screenshot" onClick={() => handleImageDelete(shot._id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Paper>
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete strategy?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This permanently deletes "{deleteTarget?.name}". If any trades are assigned to it, deletion will be
            blocked until you reassign them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
