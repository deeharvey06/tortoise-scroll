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
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';

import * as playbookApi from '../../services/playbookService';
import KpiCard from '../../components/KpiCard';
import { ConfirmationDialog } from '../../components/ui';

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
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [performance, setPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [checklistState, setChecklistState] = useState({});

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
      return;
    }
    setPerfLoading(true);
    setChecklistState({});
    playbookApi
      .fetchPlaybookPerformance(selectedId)
      .then(setPerformance)
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Playbooks</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New playbook
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
      ) : playbooks.length === 0 ? (
        <Alert severity="info">No playbooks yet. Click "New playbook" to define your first setup.</Alert>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Paper>
              <List dense>
                {playbooks.map((p) => (
                  <ListItemButton key={p._id} selected={p._id === selectedId} onClick={() => setSelectedId(p._id)}>
                    <ListItemText primary={p.setupName} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={9}>
            {selected && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="h6">{selected.setupName}</Typography>
                  <Box>
                    <IconButton size="small" aria-label="Edit playbook" onClick={() => openEdit(selected)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete playbook" onClick={() => setDeleteTarget(selected)}>
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
                  </Grid>
                ) : null}

                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, mb: 2 }}>
                      <Grid container spacing={2}>
                        {FIELDS.filter(([key]) => key !== 'setupName' && selected[key]).map(([key, label]) => (
                          <Grid item xs={12} key={key}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                              {selected[key]}
                            </Typography>
                          </Grid>
                        ))}
                        {FIELDS.filter(([key]) => key !== 'setupName' && selected[key]).length === 0 && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              No criteria documented yet — click the edit icon to fill this playbook out.
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
                            <Grid item xs={12} sm={6} key={shot._id}>
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
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Pre-trade checklist ({checkedCount}/{(selected.checklist || []).length})
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Run through this before taking the trade — it resets each time you switch playbooks.
                      </Typography>
                      {(selected.checklist || []).map((item, i) => (
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
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
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
