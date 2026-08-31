import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { format } from 'date-fns';

import * as journalApi from '../../services/journalService';
import { ConfirmationDialog } from '../../components/ui';

const TYPES = [
  { value: 'pre-market', label: 'Pre-Market Plan' },
  { value: 'daily', label: 'Daily Journal' },
  { value: 'post-market', label: 'Post-Market Review' },
  { value: 'weekly', label: 'Weekly Review' },
  { value: 'monthly', label: 'Monthly Review' },
  { value: 'freeform', label: 'Free-form Note' },
];

const TYPE_COLORS = {
  'pre-market': 'info',
  daily: 'default',
  'post-market': 'warning',
  weekly: 'secondary',
  monthly: 'secondary',
  freeform: 'default',
};

const PRE_MARKET_FIELDS = [
  ['market', 'Market'],
  ['bias', 'Bias'],
  ['keyLevels', 'Key Levels'],
  ['expectedSetups', 'Expected Setups'],
  ['invalidation', 'Invalidation'],
  ['riskLimit', 'Risk Limit'],
  ['maxTrades', 'Maximum Trades'],
  ['mentalState', 'Mental State'],
];

const POST_MARKET_FIELDS = [
  ['wentWell', 'What went well?'],
  ['wentPoorly', 'What went poorly?'],
  ['bestTrade', 'Best trade'],
  ['worstTrade', 'Worst trade'],
  ['mistakes', 'Mistakes'],
  ['followedPlan', 'Did I follow my plan?'],
  ['changeTomorrow', 'What will I change tomorrow?'],
];

function buildTemplateContent(fields, values) {
  return fields.map(([key, label]) => `${label}:\n${values[key] || ''}`).join('\n\n');
}

function emptyTemplateValues(fields) {
  return Object.fromEntries(fields.map(([key]) => [key, '']));
}

export default function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    type: 'daily',
    title: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    content: '',
  });
  const [templateValues, setTemplateValues] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await journalApi.fetchEntries(typeFilter ? { type: typeFilter } : {});
      setEntries(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load journal entries');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const templateFieldsFor = (type) => {
    if (type === 'pre-market') return PRE_MARKET_FIELDS;
    if (type === 'post-market') return POST_MARKET_FIELDS;
    return null;
  };

  const openCreate = (type = 'daily') => {
    setEditingEntry(null);
    const fields = templateFieldsFor(type);
    setForm({ type, title: '', date: format(new Date(), 'yyyy-MM-dd'), content: '' });
    setTemplateValues(fields ? emptyTemplateValues(fields) : {});
    setDialogOpen(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setForm({
      type: entry.type,
      title: entry.title || '',
      date: format(new Date(entry.date), 'yyyy-MM-dd'),
      content: entry.content || '',
    });
    setTemplateValues({});
    setDialogOpen(true);
  };

  const handleTypeChange = (type) => {
    const fields = templateFieldsFor(type);
    setForm((f) => ({ ...f, type }));
    setTemplateValues(fields ? emptyTemplateValues(fields) : {});
  };

  const handleSave = async () => {
    const fields = templateFieldsFor(form.type);
    const content = fields && !editingEntry ? buildTemplateContent(fields, templateValues) : form.content;
    const payload = {
      type: form.type,
      title: form.title,
      date: new Date(form.date).toISOString(),
      content,
    };
    try {
      if (editingEntry) {
        await journalApi.updateEntry(editingEntry._id, payload);
        setToast('Entry updated');
      } else {
        await journalApi.createEntry(payload);
        setToast('Entry created');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to save entry');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await journalApi.deleteEntry(deleteTarget._id);
      setToast('Entry deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to delete entry');
    }
  };

  const activeFields = templateFieldsFor(form.type);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Journal</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            select
            size="small"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            sx={{ minWidth: 180 }}
            label="Filter by type"
          >
            <MenuItem value="">All types</MenuItem>
            {TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openCreate('daily')}>
            New entry
          </Button>
        </Box>
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

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button size="small" variant="outlined" onClick={() => openCreate('pre-market')}>
          + Pre-Market Plan
        </Button>
        <Button size="small" variant="outlined" onClick={() => openCreate('post-market')}>
          + Post-Market Review
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Preview</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}
              {!loading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No journal entries yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                entries.map((entry) => (
                  <TableRow key={entry._id} hover>
                    <TableCell className="mono-data">{format(new Date(entry.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={TYPES.find((t) => t.value === entry.type)?.label || entry.type}
                        color={TYPE_COLORS[entry.type] || 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{entry.title || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(entry.content || '').replace(/\n/g, ' ')}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Edit entry" onClick={() => openEdit(entry)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label="Delete entry" onClick={() => setDeleteTarget(entry)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEntry ? 'Edit entry' : 'New journal entry'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                select
                label="Type"
                fullWidth
                size="small"
                value={form.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                disabled={!!editingEntry}
              >
                {TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Title (optional)"
                fullWidth
                size="small"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Grid>

            {activeFields && !editingEntry ? (
              activeFields.map(([key, label]) => (
                <Grid item xs={12} key={key}>
                  <TextField
                    label={label}
                    fullWidth
                    size="small"
                    multiline={['expectedSetups', 'mistakes', 'wentWell', 'wentPoorly'].includes(key)}
                    minRows={key === 'expectedSetups' || key === 'mistakes' ? 2 : 1}
                    value={templateValues[key] || ''}
                    onChange={(e) => setTemplateValues((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <TextField
                  label="Content"
                  fullWidth
                  multiline
                  minRows={8}
                  size="small"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingEntry ? 'Save changes' : 'Create entry'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete entry?"
        description="This permanently deletes this journal entry. This cannot be undone."
        confirmLabel="Delete entry"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
