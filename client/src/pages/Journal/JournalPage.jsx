import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PageHeader from '../../components/PageHeader';
import { format } from 'date-fns';

import * as journalApi from '../../services/journalService';
import { ConfirmationDialog, EmptyState, ErrorState, LoadingState, Panel, StatusBadge } from '../../components/ui';

const TYPES = [
  { value: 'pre-market', label: 'Pre-Market Plan' },
  { value: 'daily', label: 'Daily Journal' },
  { value: 'post-market', label: 'Post-Market Review' },
  { value: 'weekly', label: 'Weekly Review' },
  { value: 'monthly', label: 'Monthly Review' },
  { value: 'freeform', label: 'Free-form Note' },
];

const TYPE_TONES = {
  'pre-market': 'info',
  daily: 'neutral',
  'post-market': 'warning',
  weekly: 'positive',
  monthly: 'positive',
  freeform: 'neutral',
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
    <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
      <PageHeader
        eyebrow='Journal archive'
        title='The Scroll'
        description='A permanent chronological record of preparation, decisions, lessons, and progress.'
        actions={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
        </Box>}
      />

      {error && <ErrorState compact message={error} onClose={() => setError(null)} sx={{ mb: 4 }} />}
      {toast && (
        <Alert severity="success" onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast}
        </Alert>
      )}

      <Panel sx={{ mb: 5 }}>
        <Typography variant='overline' color='text.secondary'>Begin a record</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Button size='small' variant='outlined' onClick={() => openCreate('pre-market')}>Pre-market plan</Button>
          <Button size='small' variant='outlined' onClick={() => openCreate('post-market')}>Post-market review</Button>
          <Button size='small' variant='text' onClick={() => openCreate('weekly')}>Weekly review</Button>
          <Button size='small' variant='text' onClick={() => openCreate('monthly')}>Monthly review</Button>
        </Box>
      </Panel>

      {loading ? <LoadingState label='Opening The Scroll…' skeletonRows={4} /> : entries.length === 0 ? (
        <EmptyState title='The Scroll is ready' description={typeFilter ? 'No entries match this type. Choose another filter or add a new entry.' : 'Record your first plan, review, or lesson to begin your trading history.'} action={<Button variant='contained' onClick={() => openCreate('daily')}>Create entry</Button>} />
      ) : (
        <Box component='section' aria-label='Journal chronology' sx={{ position: 'relative', '&::before': { content: '""', position: 'absolute', left: { xs: 17, sm: 91 }, top: 12, bottom: 12, width: '1px', bgcolor: 'divider' } }}>
          {entries.map((entry, index) => {
            const entryDate = new Date(entry.date);
            const typeLabel = TYPES.find((type) => type.value === entry.type)?.label || entry.type;
            return <Box key={entry._id} sx={{ position: 'relative', display: 'grid', gridTemplateColumns: { xs: '36px minmax(0, 1fr)', sm: '72px 20px minmax(0, 1fr)' }, gap: { xs: 1.5, sm: 2 }, mb: index === entries.length - 1 ? 0 : 3 }}>
              <Box sx={{ display: { xs: 'none', sm: 'block' }, pt: 1.5, textAlign: 'right' }}><Typography variant='caption' className='mono-data' color='text.secondary'>{format(entryDate, 'MMM')}</Typography><Typography variant='h6' className='mono-data'>{format(entryDate, 'd')}</Typography><Typography variant='caption' className='mono-data' color='text.muted'>{format(entryDate, 'yyyy')}</Typography></Box>
              <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: 'primary.main', border: '3px solid', borderColor: 'background.default', boxSizing: 'content-box', mt: 2, ml: { xs: 1, sm: 0 }, zIndex: 1 }} />
              <Panel interactive sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}><StatusBadge label={typeLabel} tone={TYPE_TONES[entry.type]} /><Typography variant='caption' className='mono-data' color='text.secondary' sx={{ display: { sm: 'none' } }}>{format(entryDate, 'MMM d, yyyy')}</Typography></Box><Typography variant='h6' component='h2'>{entry.title || typeLabel}</Typography></Box>
                  <Box sx={{ display: 'flex' }}><IconButton size='small' aria-label='Edit entry' onClick={() => openEdit(entry)}><EditIcon fontSize='small' /></IconButton><IconButton size='small' aria-label='Delete entry' onClick={() => setDeleteTarget(entry)}><DeleteIcon fontSize='small' /></IconButton></Box>
                </Box>
                <Typography component='div' variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.75 }}>{entry.content || 'No content recorded.'}</Typography>
              </Panel>
            </Box>;
          })}
        </Box>
      )}

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
