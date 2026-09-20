import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import api from '../services/api';
import useFilterStore from '../store/useFilterStore';
import { ConfirmationDialog, LoadingState, EmptyState } from './ui';

export const FILTER_KEYS = [
  'followedPlan',
  'outcome',
  'datePreset',
  'customFrom',
  'customTo',
  'accountId',
  'symbol',
  'strategy',
  'setup',
  'direction',
  'session',
  'tags',
];

export const snapshotFilters = (state) =>
  Object.fromEntries(
    FILTER_KEYS.map((k) => [
      k,
      k.startsWith('custom') ? state[k] || null : state[k],
    ])
  );

export default function SavedFilters() {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState([]),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [remove, setRemove] = useState(null);

  async function load() {
    setOpen(true);
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.get('/settings/workspace');
      setItems(data.savedFilters || []);
    } catch {
      setError('Unable to load saved filters. Retry before saving.');
    } finally {
      setBusy(false);
    }
  }

  async function save(next) {
    setBusy(true);
    setError('');

    try {
      const { data } = await api.put('/settings/workspace', {
        savedFilters: next,
      });
      setItems(data.savedFilters || []);
      setRemove(null);
      setName('');
      setNotice('Saved filters updated.');
    } catch {
      setError('Unable to save filters. Your changes were not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size='small' onClick={load}>
        Saved filters
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        maxWidth='sm'
        fullWidth
        aria-labelledby='saved-filters-title'
      >
        <DialogTitle id='saved-filters-title'>Saved filters</DialogTitle>
        <DialogContent>
          <Typography variant='body2' sx={{ mb: 2 }}>
            Save the current global filters for Trades and reports. Relative
            date presets are recalculated when applied; custom dates remain
            fixed.
          </Typography>
          {error && (
            <Alert
              severity='error'
              action={
                <Button disabled={busy} onClick={load}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}
          {notice && <Alert severity='success'>{notice}</Alert>}
          {busy ? (
            <LoadingState label='Loading or saving filters…' />
          ) : (
            <>
              <Stack spacing={2}>
                {items.map((item) => (
                  <Stack
                    key={item.id}
                    direction='row'
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <Typography sx={{ flex: 1, overflowWrap: 'anywhere' }}>
                      {item.name}
                    </Typography>
                    <Button
                      onClick={() => {
                        useFilterStore.setState({
                          ...item.filters,
                          filtersTouched: true,
                        });
                        setOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                    <Button color='error' onClick={() => setRemove(item)}>
                      Delete
                    </Button>
                  </Stack>
                ))}
              </Stack>
              {!items.length && (
                <EmptyState
                  title='No saved filters'
                  description='Set your filters, then save them with a name.'
                />
              )}
              <TextField
                label='Filter name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                inputProps={{ maxLength: 80 }}
                fullWidth
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            disabled={busy || !!error || !name.trim() || items.length >= 30}
            onClick={() =>
              save([
                ...items,
                {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  filters: snapshotFilters(useFilterStore.getState()),
                },
              ])
            }
          >
            Save current filters
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={!!remove}
        title='Delete saved filter?'
        description={`Remove “${remove?.name}”? Trades are unaffected.`}
        confirmLabel='Delete filter'
        loading={busy}
        onClose={() => setRemove(null)}
        onConfirm={() => save(items.filter((v) => v.id !== remove.id))}
      />
    </>
  );
}
