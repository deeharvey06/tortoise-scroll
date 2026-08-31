import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import * as strategyApi from '../../services/strategyService';
import * as playbookApi from '../../services/playbookService';

const ASSET_TYPES = ['equity', 'option', 'future', 'forex', 'crypto', 'other'];
const SESSIONS = ['pre-market', 'open', 'mid-day', 'power-hour', 'after-hours', 'unspecified'];

function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const emptyDefaults = {
  accountId: '',
  symbol: '',
  assetType: 'equity',
  direction: 'long',
  quantity: '',
  entryPrice: '',
  exitPrice: '',
  entryTime: '',
  exitTime: '',
  stopLoss: '',
  riskAmount: '',
  fees: '0',
  commission: '0',
  setup: '',
  strategy: '',
  playbook: '',
  session: 'unspecified',
  notes: '',
  tagsInput: '',
  followedPlan: null,
};

export default function TradeFormDialog({ open, onClose, onSubmit, accounts, initialTrade }) {
  const { control, handleSubmit, reset } = useForm({ defaultValues: emptyDefaults });
  const [strategies, setStrategies] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);

  useEffect(() => {
    if (!open) return;
    strategyApi.fetchStrategies().then(setStrategies).catch(() => {});
    playbookApi.fetchPlaybooks().then(setPlaybooks).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialTrade) {
      reset({
        accountId: initialTrade.accountId || '',
        symbol: initialTrade.symbol || '',
        assetType: initialTrade.assetType || 'equity',
        direction: initialTrade.direction || 'long',
        quantity: initialTrade.quantity ?? '',
        entryPrice: initialTrade.entryPrice ?? '',
        exitPrice: initialTrade.exitPrice ?? '',
        entryTime: toLocalInputValue(initialTrade.entryTime),
        exitTime: toLocalInputValue(initialTrade.exitTime),
        stopLoss: initialTrade.stopLoss ?? '',
        riskAmount: initialTrade.riskAmount ?? '',
        fees: initialTrade.fees ?? '0',
        commission: initialTrade.commission ?? '0',
        setup: initialTrade.setup || '',
        strategy: initialTrade.strategy || '',
        playbook: initialTrade.playbook || '',
        session: initialTrade.session || 'unspecified',
        notes: initialTrade.notes || '',
        tagsInput: (initialTrade.tags || []).join(', '),
        followedPlan: initialTrade.followedPlan ?? null,
      });
    } else {
      reset({ ...emptyDefaults, accountId: accounts?.[0]?._id || '' });
    }
  }, [open, initialTrade, accounts, reset]);

  const submit = (values) => {
    const payload = {
      accountId: values.accountId,
      symbol: values.symbol.toUpperCase().trim(),
      assetType: values.assetType,
      direction: values.direction,
      quantity: Number(values.quantity),
      entryPrice: Number(values.entryPrice),
      exitPrice: values.exitPrice === '' ? null : Number(values.exitPrice),
      entryTime: values.entryTime ? new Date(values.entryTime).toISOString() : null,
      exitTime: values.exitTime ? new Date(values.exitTime).toISOString() : null,
      stopLoss: values.stopLoss === '' ? null : Number(values.stopLoss),
      riskAmount: values.riskAmount === '' ? null : Number(values.riskAmount),
      fees: Number(values.fees || 0),
      commission: Number(values.commission || 0),
      setup: values.setup,
      strategy: values.strategy || null,
      playbook: values.playbook || null,
      session: values.session,
      notes: values.notes,
      tags: values.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      followedPlan: values.followedPlan,
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initialTrade ? 'Edit trade' : 'New trade'}</DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Controller
                name="accountId"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField {...field} select label="Account" fullWidth required size="small">
                    {(accounts || []).map((a) => (
                      <MenuItem key={a._id} value={a._id}>
                        {a.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="symbol"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField {...field} label="Symbol" fullWidth required size="small" placeholder="AAPL" />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="assetType"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Asset type" fullWidth size="small">
                    {ASSET_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="direction"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Direction" fullWidth size="small">
                    <MenuItem value="long">Long</MenuItem>
                    <MenuItem value="short">Short</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="quantity"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField {...field} type="number" label="Quantity" fullWidth required size="small" />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="entryPrice"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Entry price"
                    fullWidth
                    required
                    size="small"
                    inputProps={{ step: 'any' }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="exitPrice"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Exit price (blank if open)"
                    fullWidth
                    size="small"
                    inputProps={{ step: 'any' }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="entryTime"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="datetime-local"
                    label="Entry time"
                    fullWidth
                    required
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="exitTime"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="datetime-local"
                    label="Exit time"
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="stopLoss"
                control={control}
                render={({ field }) => (
                  <TextField {...field} type="number" label="Stop loss" fullWidth size="small" inputProps={{ step: 'any' }} />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="riskAmount"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Risk amount ($)"
                    fullWidth
                    size="small"
                    helperText="Used for R multiple; falls back to stop-loss distance"
                    inputProps={{ step: 'any' }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="session"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Session" fullWidth size="small">
                    {SESSIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={4}>
              <Controller
                name="fees"
                control={control}
                render={({ field }) => (
                  <TextField {...field} type="number" label="Fees" fullWidth size="small" inputProps={{ step: 'any' }} />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="commission"
                control={control}
                render={({ field }) => (
                  <TextField {...field} type="number" label="Commission" fullWidth size="small" inputProps={{ step: 'any' }} />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <Controller
                name="setup"
                control={control}
                render={({ field }) => <TextField {...field} label="Setup" fullWidth size="small" placeholder="Breakout" />}
              />
            </Grid>

            <Grid item xs={6}>
              <Controller
                name="strategy"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Strategy (optional)" fullWidth size="small">
                    <MenuItem value="">— none —</MenuItem>
                    {strategies.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <Controller
                name="playbook"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Playbook (optional)" fullWidth size="small">
                    <MenuItem value="">— none —</MenuItem>
                    {playbooks.map((p) => (
                      <MenuItem key={p._id} value={p._id}>
                        {p.setupName}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="tagsInput"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Tags (comma separated)" fullWidth size="small" placeholder="momentum, gap-up" />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => <TextField {...field} label="Notes" fullWidth multiline minRows={3} size="small" />}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Discretionary journaling
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Controller
                name="followedPlan"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label="Followed my trading plan"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {initialTrade ? 'Save changes' : 'Create trade'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
