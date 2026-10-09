import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';

import api from '@/services/api';
import { ConfirmationDialog, LoadingState } from '@/components/ui';

const fields = {
  strategy: 'Strategy',
  playbook: 'Playbook',
  setup: 'Setup',
  session: 'Session',
  mistake: 'Mistakes',
  followedPlan: 'Followed plan',
  tags: 'Tags',
};

export default function BulkEditDialog({ ids, onClose, onSaved }) {
  const [field, setField] = useState('setup');
  const [value, setValue] = useState('');
  const [strategies, setStrategies] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);

    Promise.all([api.get('/strategies'), api.get('/playbooks')])
      .then(([s, p]) => {
        if (active) {
          setStrategies(s.data);
          setPlaybooks(p.data);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load classifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retry]);

  async function save() {
    setBusy(true);
    setError('');

    try {
      let next = value;
      if (['strategy', 'playbook'].includes(field)) next = value || null;
      if (['tags', 'mistake'].includes(field))
        next = [
          ...new Set(
            value
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          ),
        ];

      if (field === 'followedPlan')
        next = value === '' ? null : value === 'true';

      const { data } = await api.post('/trades/bulk-edit', {
        ids,
        changes: { [field]: next },
      });

      onSaved(data.modifiedCount);
      onClose();
    } catch (e) {
      setConfirm(false);
      setError(e.response?.data?.error?.message || 'Unable to update trades.');
    } finally {
      setBusy(false);
    }
  }

  const options =
    field === 'strategy'
      ? strategies.map((v) => [v._id, v.name])
      : field === 'playbook'
        ? playbooks.map((v) => [v._id, v.setupName])
        : field === 'session'
          ? [
              'pre-market',
              'open',
              'mid-day',
              'power-hour',
              'after-hours',
              'unspecified',
            ].map((v) => [v, v])
          : field === 'followedPlan'
            ? [
                ['true', 'Yes'],
                ['false', 'No'],
              ]
            : null;
  return (
    <>
      <Dialog
        open
        onClose={() => !busy && onClose()}
        fullWidth
        maxWidth='sm'
        aria-labelledby='bulk-edit-title'
      >
        <DialogTitle id='bulk-edit-title'>
          Edit {ids.length} selected trades
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert
              severity='error'
              action={
                <Button onClick={() => setRetry((v) => v + 1)}>Retry</Button>
              }
            >
              {error}
            </Alert>
          )}
          {loading ? (
            <LoadingState label='Loading classifications…' />
          ) : (
            <Stack spacing={3} sx={{ pt: 1 }}>
              <TextField
                select
                label='Field to edit'
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setValue(e.target.value === 'session' ? 'unspecified' : '');
                }}
              >
                {Object.entries(fields).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select={!!options}
                label='New value'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                helperText={
                  ['tags', 'mistake'].includes(field)
                    ? 'Comma separated. Replaces the existing list; blank clears it.'
                    : 'Only this field will change. Blank clears the assignment.'
                }
              >
                {options && [
                  ...(field === 'session'
                    ? []
                    : [
                        <MenuItem key='clear' value=''>
                          Not assigned
                        </MenuItem>,
                      ]),
                  ...options.map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v}
                    </MenuItem>
                  )),
                ]}
              </TextField>
              <Alert severity='warning'>
                This replaces {fields[field].toLowerCase()} on all {ids.length}{' '}
                selected trades. Other fields and financial results remain
                unchanged.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || loading || !!error}
            onClick={() => setConfirm(true)}
          >
            Review changes
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmationDialog
        open={confirm}
        title='Apply bulk changes?'
        description={`Replace ${fields[field].toLowerCase()} on ${ids.length} trades with ${value || 'no value'}?`}
        confirmLabel='Apply changes'
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={save}
      />
    </>
  );
}
