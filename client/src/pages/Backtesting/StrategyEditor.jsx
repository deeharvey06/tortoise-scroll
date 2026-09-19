import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import api from '../../services/api';
import * as backtestApi from '../../services/backtestService';

export const initialStrategy = {
  version: 1,
  name: 'EMA inside-bar breakout',
  setup: 'Inside bar',
  direction: 'long',
  all: [
    { type: 'ema', period: 20, comparison: 'above' },
    { type: 'insideBar', offset: 1 },
    { type: 'session', value: 'rth' },
  ],
  entry: { type: 'stop', reference: 'high', offset: 0 },
  stop: { type: 'signalExtreme' },
  target: { type: 'rMultiple', value: 2 },
  exitOnOppositeCross: false,
};

export const initialExecution = {
  version: 1,
  accepted: false,
  intrabarPath: 'open-low-high-close',
  sessionBoundary: 'flatten',
  endOfData: 'leaveOpen',
  pendingAcrossSessions: 'cancel',
  quantity: 1,
  slippageTicks: 0,
  commissionPerUnitPerSide: 0,
  fillPolicy: 'full-touch-no-volume-limit',
  timeInForce: 'nextBar',
  missingBars: 'reject',
  futuresRollover: 'single-contract-no-roll',
};

const defaults = {
  ema: { type: 'ema', period: 20, comparison: 'above' },
  smaCross: {
    type: 'smaCross',
    fastPeriod: 10,
    slowPeriod: 30,
    direction: 'above',
  },
  insideBar: { type: 'insideBar', offset: 1 },
  session: { type: 'session', value: 'rth' },
};

function Select({ label, value, options, onChange }) {
  return (
    <TextField
      select
      fullWidth
      size='small'
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((item) => (
        <MenuItem key={item} value={item}>
          {item}
        </MenuItem>
      ))}
    </TextField>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <TextField
      fullWidth
      size='small'
      label={label}
      type='number'
      value={value}
      inputProps={{ step: 'any' }}
      onChange={(e) =>
        onChange(e.target.value === '' ? '' : Number(e.target.value))
      }
    />
  );
}

export default function StrategyEditor({ config, onClose, onSaved }) {
  const [form, setForm] = useState(
    config || {
      name: '',
      datasetId: '',
      symbol: '',
      timeframe: '',
      dateFrom: '',
      dateTo: '',
    }
  );

  const [strategy, setStrategy] = useState(
    config?.strategyDefinition || structuredClone(initialStrategy)
  );

  const [execution, setExecution] = useState({
    ...(config?.execution || initialExecution),
    accepted: false,
  });

  const [datasets, setDatasets] = useState([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get('/market-data/datasets')
      .then((r) => {
        if (active) setDatasets(r.data.datasets);
      })
      .catch((e) => {
        if (active) setError(e.response?.data?.error?.message || e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPolicy = (key, value) =>
    setExecution((old) => ({ ...old, [key]: value, accepted: false }));

  const setRule = (index, patch) =>
    setStrategy((old) => ({
      ...old,
      all: old.all.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule
      ),
    }));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        datasetId: form.datasetId,
        symbol: form.symbol,
        timeframe: form.timeframe,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        engineVersion: 2,
        direction: strategy.direction,
        strategyDefinition: strategy,
        execution,
      };

      if (config) await backtestApi.updateConfig(config._id, payload);
      else await backtestApi.createConfig(payload);

      onSaved();
    } catch (e) {
      setError(e.response?.data?.error?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth='md'>
      <DialogTitle>
        {config ? 'Edit strategy backtest' : 'New strategy backtest'}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity='error'>{error}</Alert>}
        {loading ? (
          <CircularProgress aria-label='Loading datasets' />
        ) : (
          !datasets.length && (
            <Alert severity='warning'>
              No historical datasets available. Configure your owned local
              market-data catalog.
            </Alert>
          )
        )}
        <Stack spacing={2} sx={{ mt: 2 }}>
          <TextField
            label='Backtest name'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            select
            label='Historical dataset'
            value={form.datasetId}
            onChange={(e) => {
              const d = datasets.find((item) => item.id === e.target.value);
              setForm({
                ...form,
                datasetId: d.id,
                symbol: d.symbol,
                timeframe: d.timeframe,
                dateFrom: d.calendar.from,
                dateTo: d.calendar.to,
              });
            }}
          >
            {datasets.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.symbol} · {d.timeframe} · {d.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label='From (ISO timestamp with offset)'
            value={form.dateFrom}
            onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
          />
          <TextField
            label='To (exclusive ISO timestamp)'
            value={form.dateTo}
            onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
          />
          <TextField
            label='Strategy label'
            value={strategy.name}
            onChange={(e) => setStrategy({ ...strategy, name: e.target.value })}
          />
          <TextField
            label='Setup label'
            value={strategy.setup}
            onChange={(e) =>
              setStrategy({ ...strategy, setup: e.target.value })
            }
          />
          <Select
            label='Direction'
            value={strategy.direction}
            options={['long', 'short']}
            onChange={(direction) => setStrategy({ ...strategy, direction })}
          />
          <Typography variant='h6'>All signal conditions (AND)</Typography>
          <Typography variant='body2'>
            Evaluated after each completed candle. EMA starts from the first
            close and waits for its period; inside bars require strictly lower
            highs and higher lows.
          </Typography>
          {strategy.all.map((rule, i) => (
            <Stack
              key={i}
              spacing={1}
              sx={{
                border: 1,
                borderColor: 'divider',
                p: 1.5,
                borderRadius: 1,
              }}
            >
              <Select
                label={`Condition ${i + 1}`}
                value={rule.type}
                options={Object.keys(defaults)}
                onChange={(type) =>
                  setStrategy({
                    ...strategy,
                    all: strategy.all.map((r, n) =>
                      n === i ? { ...defaults[type] } : r
                    ),
                  })
                }
              />
              {rule.type === 'ema' && (
                <>
                  <NumberField
                    label={`EMA period ${i + 1}`}
                    value={rule.period}
                    onChange={(period) => setRule(i, { period })}
                  />
                  <Select
                    label={`EMA comparison ${i + 1}`}
                    value={rule.comparison}
                    options={['above', 'below']}
                    onChange={(comparison) => setRule(i, { comparison })}
                  />
                </>
              )}
              {rule.type === 'smaCross' && (
                <>
                  <NumberField
                    label={`Fast SMA ${i + 1}`}
                    value={rule.fastPeriod}
                    onChange={(fastPeriod) => setRule(i, { fastPeriod })}
                  />
                  <NumberField
                    label={`Slow SMA ${i + 1}`}
                    value={rule.slowPeriod}
                    onChange={(slowPeriod) => setRule(i, { slowPeriod })}
                  />
                  <Select
                    label={`Cross direction ${i + 1}`}
                    value={rule.direction}
                    options={['above', 'below']}
                    onChange={(direction) => setRule(i, { direction })}
                  />
                </>
              )}
              {rule.type === 'insideBar' && (
                <Select
                  label={`Inside bar offset ${i + 1}`}
                  value={rule.offset}
                  options={[0, 1]}
                  onChange={(offset) => setRule(i, { offset: Number(offset) })}
                />
              )}
              {rule.type === 'session' && (
                <Select
                  label={`Session ${i + 1}`}
                  value={rule.value}
                  options={['rth', 'eth', 'premarket', 'postmarket', 'daily']}
                  onChange={(value) => setRule(i, { value })}
                />
              )}
              <Button
                disabled={strategy.all.length === 1}
                onClick={() =>
                  setStrategy({
                    ...strategy,
                    all: strategy.all.filter((_, n) => i !== n),
                  })
                }
              >
                Remove condition {i + 1}
              </Button>
            </Stack>
          ))}
          <Button
            disabled={strategy.all.length >= 12}
            onClick={() =>
              setStrategy({
                ...strategy,
                all: [...strategy.all, { ...defaults.session }],
              })
            }
          >
            Add condition
          </Button>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={4}>
              <Select
                label='Entry order'
                value={strategy.entry.type}
                options={['market', 'stop', 'limit']}
                onChange={(type) =>
                  setStrategy({
                    ...strategy,
                    entry: { ...strategy.entry, type },
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Select
                label='Signal price reference'
                value={strategy.entry.reference}
                options={['high', 'low', 'close']}
                onChange={(reference) =>
                  setStrategy({
                    ...strategy,
                    entry: { ...strategy.entry, reference },
                  })
                }
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <NumberField
                label='Entry offset (price units)'
                value={strategy.entry.offset}
                onChange={(offset) =>
                  setStrategy({
                    ...strategy,
                    entry: { ...strategy.entry, offset },
                  })
                }
              />
            </Grid>
          </Grid>
          <Select
            label='Stop rule'
            value={strategy.stop.type}
            options={['signalExtreme', 'distance', 'percent']}
            onChange={(type) =>
              setStrategy({
                ...strategy,
                stop: type === 'signalExtreme' ? { type } : { type, value: 1 },
              })
            }
          />
          {strategy.stop.type !== 'signalExtreme' && (
            <NumberField
              label='Stop distance (points or percent)'
              value={strategy.stop.value}
              onChange={(value) =>
                setStrategy({ ...strategy, stop: { ...strategy.stop, value } })
              }
            />
          )}
          <Select
            label='Target rule'
            value={strategy.target.type}
            options={['rMultiple', 'percent']}
            onChange={(type) =>
              setStrategy({ ...strategy, target: { type, value: 2 } })
            }
          />
          <NumberField
            label='Target value (R or percent)'
            value={strategy.target.value}
            onChange={(value) =>
              setStrategy({
                ...strategy,
                target: { ...strategy.target, value },
              })
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={strategy.exitOnOppositeCross}
                onChange={(e) =>
                  setStrategy({
                    ...strategy,
                    exitOnOppositeCross: e.target.checked,
                  })
                }
              />
            }
            label='Exit on opposite configured SMA cross (next open)'
          />
          <Typography variant='h6'>Execution assumptions</Typography>
          <Alert severity='info'>
            A confirmed instrument tick size, contract multiplier and currency
            are required. Missing metadata must be configured in your existing
            instrument specifications before running.
          </Alert>
          <Alert severity='warning'>
            OHLC bars do not reveal the intrabar path. Select the modeled path
            below; it determines which stop/target fills first. Full fills on
            touch, no volume/queue model. Orders are eligible only on the next
            bar and expire afterward. Stop gaps fill at the open with adverse
            slippage; limits never fill worse than their limit. Costs use the
            instrument currency; no FX conversion. Only dated futures contracts
            are supported, with no rollover.
          </Alert>
          <Select
            label='Intrabar path'
            value={execution.intrabarPath}
            options={['open-low-high-close', 'open-high-low-close']}
            onChange={(v) => setPolicy('intrabarPath', v)}
          />
          <Select
            label='Session boundary'
            value={execution.sessionBoundary}
            options={['carry', 'flatten']}
            onChange={(v) => setPolicy('sessionBoundary', v)}
          />
          <Select
            label='Pending orders across sessions'
            value={execution.pendingAcrossSessions}
            options={['cancel', 'allow']}
            onChange={(v) => setPolicy('pendingAcrossSessions', v)}
          />
          <Select
            label='End of data'
            value={execution.endOfData}
            options={['leaveOpen', 'close']}
            onChange={(v) => setPolicy('endOfData', v)}
          />
          <NumberField
            label='Quantity'
            value={execution.quantity}
            onChange={(v) => setPolicy('quantity', v)}
          />
          <NumberField
            label='Adverse slippage (ticks)'
            value={execution.slippageTicks}
            onChange={(v) => setPolicy('slippageTicks', v)}
          />
          <NumberField
            label='Commission per unit per side'
            value={execution.commissionPerUnitPerSide}
            onChange={(v) => setPolicy('commissionPerUnitPerSide', v)}
          />
          <Typography variant='body2'>
            One position at a time, no scaling. Stops use the signal extreme or
            the selected distance from the slipped entry; targets use actual
            initial risk. Tick rounding is adverse. Flatten closes at declared
            session-segment ends. Missing bars fail the run. Open positions are
            shown separately from realized statistics.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={execution.accepted}
                onChange={(e) =>
                  setExecution({ ...execution, accepted: e.target.checked })
                }
              />
            }
            label='I accept these execution assumptions and costs'
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant='contained'
          onClick={save}
          disabled={
            saving || !form.name || !form.datasetId || !execution.accepted
          }
        >
          {saving ? 'Saving…' : 'Save strategy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
