import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/AddOutlined';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import RestoreIcon from '@mui/icons-material/RestoreOutlined';
import StarBorderIcon from '@mui/icons-material/StarBorderOutlined';
import StarIcon from '@mui/icons-material/StarOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import PageHeader from '../../components/PageHeader';
import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  SectionHeader,
  StatusBadge,
} from '../../components/ui';
import * as accountApi from '../../services/accountService';
import * as instrumentApi from '../../services/instrumentSpecificationService';

const ACCOUNT_TYPES = [
  'cash',
  'margin',
  'futures',
  'retirement',
  'paper',
  'other',
];

const ASSET_TYPES = ['future', 'option', 'equity', 'forex', 'crypto', 'other'];

const EMPTY_ACCOUNT = {
  name: '',
  broker: '',
  accountType: 'other',
  currency: 'USD',
  startingBalance: 0,
  isDefault: false,
  tradingConfig: {
    defaultInstrumentSymbol: '',
    defaultTimeframe: '',
    preferredSession: 'unspecified',
    timezone: '',
    notes: '',
  },
};

const EMPTY_SPEC = {
  symbol: '',
  assetType: 'future',
  tickSize: '',
  tickValue: '',
  pointValue: '',
  contractMultiplier: '',
  currency: 'USD',
  exchange: '',
  timezone: 'America/Chicago',
  session: 'eth',
};

function money(value, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(Number(value || 0));
}

function AccountDialog({ open, account, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_ACCOUNT);

  useEffect(() => {
    if (!open) return;
    setForm(
      account
        ? {
            ...EMPTY_ACCOUNT,
            ...account,
            tradingConfig: {
              ...EMPTY_ACCOUNT.tradingConfig,
              ...(account.tradingConfig || {}),
            },
          }
        : EMPTY_ACCOUNT
    );
  }, [open, account]);

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setConfig = (key, value) =>
    setForm((current) => ({
      ...current,
      tradingConfig: { ...current.tradingConfig, [key]: value },
    }));

  const submit = () => {
    onSave({
      ...form,
      startingBalance: Number(form.startingBalance || 0),
      tradingConfig: { ...form.tradingConfig },
    });
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth='md'
      fullWidth
    >
      <DialogTitle>{account ? 'Edit account' : 'Add account'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              autoFocus
              label='Account name'
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label='Broker'
              value={form.broker}
              onChange={(event) => setField('broker', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label='Account type'
              value={form.accountType}
              onChange={(event) => setField('accountType', event.target.value)}
            >
              {ACCOUNT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label='Currency'
              value={form.currency}
              inputProps={{ maxLength: 3 }}
              onChange={(event) =>
                setField('currency', event.target.value.toUpperCase())
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type='number'
              label='Starting balance'
              value={form.startingBalance}
              onChange={(event) =>
                setField('startingBalance', event.target.value)
              }
            />
          </Grid>

          <Grid item xs={12}>
            <Divider>
              <Typography variant='caption' color='text.secondary'>
                Trading configuration
              </Typography>
            </Divider>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label='Default instrument'
              value={form.tradingConfig.defaultInstrumentSymbol || ''}
              onChange={(event) =>
                setConfig(
                  'defaultInstrumentSymbol',
                  event.target.value.toUpperCase()
                )
              }
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label='Default timeframe'
              value={form.tradingConfig.defaultTimeframe || ''}
              onChange={(event) =>
                setConfig('defaultTimeframe', event.target.value)
              }
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              select
              label='Preferred session'
              value={form.tradingConfig.preferredSession || 'unspecified'}
              onChange={(event) =>
                setConfig('preferredSession', event.target.value)
              }
            >
              {[
                'pre-market',
                'open',
                'mid-day',
                'power-hour',
                'after-hours',
                'unspecified',
              ].map((session) => (
                <MenuItem key={session} value={session}>
                  {session}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label='Trading timezone'
              value={form.tradingConfig.timezone || ''}
              placeholder='America/Los_Angeles'
              onChange={(event) => setConfig('timezone', event.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label='Account notes'
              value={form.tradingConfig.notes || ''}
              onChange={(event) => setConfig('notes', event.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant='contained'
          onClick={submit}
          disabled={saving || !form.name.trim()}
        >
          {saving ? 'Saving…' : 'Save account'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SpecDialog({ open, spec, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_SPEC);

  useEffect(() => {
    if (open) setForm(spec ? { ...EMPTY_SPEC, ...spec } : EMPTY_SPEC);
  }, [open, spec]);

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    onSave({
      ...form,
      symbol: form.symbol.toUpperCase().trim(),
      tickSize: form.tickSize === '' ? null : Number(form.tickSize),
      tickValue: form.tickValue === '' ? null : Number(form.tickValue),
      pointValue: form.pointValue === '' ? null : Number(form.pointValue),
      contractMultiplier: Number(form.contractMultiplier),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth='md'
      fullWidth
    >
      <DialogTitle>
        {spec
          ? 'Edit custom instrument specification'
          : 'Add custom instrument specification'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              label='Symbol'
              value={form.symbol}
              onChange={(event) =>
                setField('symbol', event.target.value.toUpperCase())
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label='Asset type'
              value={form.assetType}
              onChange={(event) => setField('assetType', event.target.value)}
            >
              {ASSET_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              type='number'
              label='Contract multiplier'
              value={form.contractMultiplier}
              onChange={(event) =>
                setField('contractMultiplier', event.target.value)
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type='number'
              label='Tick size'
              value={form.tickSize ?? ''}
              onChange={(event) => setField('tickSize', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type='number'
              label='Tick value'
              value={form.tickValue ?? ''}
              onChange={(event) => setField('tickValue', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              type='number'
              label='Point value'
              value={form.pointValue ?? ''}
              onChange={(event) => setField('pointValue', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label='Currency'
              value={form.currency}
              onChange={(event) =>
                setField('currency', event.target.value.toUpperCase())
              }
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label='Exchange'
              value={form.exchange}
              onChange={(event) => setField('exchange', event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label='Timezone'
              value={form.timezone}
              onChange={(event) => setField('timezone', event.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant='contained'
          onClick={submit}
          disabled={
            saving || !form.symbol || !(Number(form.contractMultiplier) > 0)
          }
        >
          {saving ? 'Saving…' : 'Save specification'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AccountDetails({ account, refreshToken }) {
  const [performance, setPerformance] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([
      accountApi.fetchAccountPerformance(account._id),
      accountApi.fetchAccountImportHistory(account._id),
    ])
      .then(([performanceResult, importResult]) => {
        if (!live) return;
        setPerformance(performanceResult);
        setImports(importResult);
      })
      .catch((requestError) => {
        if (live) {
          setError(
            requestError.response?.data?.error?.message || requestError.message
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [account._id, refreshToken]);

  if (loading) {
    return <LoadingState label='Loading account details…' skeletonRows={3} />;
  }
  if (error) return <ErrorState compact message={error} />;

  const metrics = [
    ['Net P&L', money(performance?.netPnL, account.currency)],
    ['Current balance', money(performance?.currentBalance, account.currency)],
    ['Trades', performance?.tradeCount ?? 0],
    ['Win rate', `${performance?.winRate ?? 0}%`],
    ['Total R', `${performance?.totalR ?? 0}R`],
  ];

  return (
    <Box sx={{ py: 2 }}>
      <Grid container spacing={2}>
        {metrics.map(([label, value]) => (
          <Grid item xs={6} md key={label}>
            <Panel padding={2}>
              <Typography variant='caption' color='text.secondary'>
                {label}
              </Typography>
              <Typography variant='h6' className='mono-data'>
                {value}
              </Typography>
            </Panel>
          </Grid>
        ))}
      </Grid>

      <SectionHeader
        title='Recent imports'
        description='Latest imports associated with this account.'
        sx={{ mt: 4, mb: 2 }}
      />
      {imports.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          No imports yet.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align='right'>Imported</TableCell>
                <TableCell align='right'>Errors</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {imports.slice(0, 8).map((job) => (
                <TableRow key={job._id}>
                  <TableCell>
                    {new Date(job.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{job.broker}</TableCell>
                  <TableCell>{job.originalFilename || '—'}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={job.status}
                      tone={
                        job.status === 'completed' ? 'positive' : 'negative'
                      }
                    />
                  </TableCell>
                  <TableCell align='right'>
                    {job.summary?.executionsImported ??
                      job.summary?.imported ??
                      0}
                  </TableCell>
                  <TableCell align='right'>
                    {job.summary?.errors ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}

function AccountsTable({
  accounts,
  expandedId,
  onToggleExpanded,
  onEdit,
  onDefault,
  onArchive,
  refreshToken,
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title='No active accounts'
        description='Add an account to start importing and journaling trades.'
      />
    );
  }

  return (
    <Panel padding={0}>
      <Box sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account</TableCell>
              <TableCell>Broker</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align='right'>Starting balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accounts.map((account) => (
              <Fragment key={account._id}>
                <TableRow
                  hover
                  onClick={() => onToggleExpanded(account._id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {account.isDefault && (
                        <StarIcon fontSize='small' color='primary' />
                      )}
                      <Box>
                        <Typography variant='body2' fontWeight={600}>
                          {account.name}
                        </Typography>
                        {account.tradingConfig?.defaultInstrumentSymbol && (
                          <Typography variant='caption' color='text.secondary'>
                            Default:{' '}
                            {account.tradingConfig.defaultInstrumentSymbol}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{account.broker || '—'}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {account.accountType}
                  </TableCell>
                  <TableCell>{account.currency}</TableCell>
                  <TableCell align='right' className='mono-data'>
                    {money(account.startingBalance, account.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label='Active' tone='positive' />
                  </TableCell>
                  <TableCell
                    align='right'
                    onClick={(event) => event.stopPropagation()}
                  >
                    <IconButton
                      aria-label={`Make ${account.name} default`}
                      disabled={account.isDefault}
                      onClick={() => onDefault(account)}
                    >
                      {account.isDefault ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                    <IconButton
                      aria-label={`Edit ${account.name}`}
                      onClick={() => onEdit(account)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Archive ${account.name}`}
                      onClick={() => onArchive(account)}
                    >
                      <ArchiveIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
                {expandedId === account._id && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <AccountDetails
                        account={account}
                        refreshToken={refreshToken}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Panel>
  );
}

function ArchivedAccounts({ accounts, onRestore, onDelete }) {
  if (accounts.length === 0) return null;
  return (
    <Box sx={{ mt: 5 }}>
      <SectionHeader
        title='Archived accounts'
        description='Historical data is preserved. Restore an account to make it selectable again.'
      />
      <Panel padding={0}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell>Archived</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account._id}>
                  <TableCell>{account.name}</TableCell>
                  <TableCell>{account.broker || '—'}</TableCell>
                  <TableCell>
                    {account.archivedAt
                      ? new Date(account.archivedAt).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell align='right'>
                    <IconButton
                      aria-label={`Restore ${account.name}`}
                      onClick={() => onRestore(account)}
                    >
                      <RestoreIcon />
                    </IconButton>
                    <IconButton
                      aria-label={`Delete ${account.name}`}
                      onClick={() => onDelete(account)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Panel>
    </Box>
  );
}

function InstrumentSpecifications({ specs, onEdit, onDelete }) {
  return (
    <Box>
      <SectionHeader
        title='Contract specifications'
        description='One authoritative specification path prevents symbol-specific multiplier logic from being scattered through imports and calculations.'
      />

      {specs.custom.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant='subtitle2' sx={{ mb: 2 }}>
            Your overrides
          </Typography>
          <Panel padding={0}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Asset</TableCell>
                    <TableCell align='right'>Tick size</TableCell>
                    <TableCell align='right'>Tick value</TableCell>
                    <TableCell align='right'>Point value</TableCell>
                    <TableCell align='right'>Multiplier</TableCell>
                    <TableCell>Exchange</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {specs.custom.map((spec) => (
                    <TableRow key={spec._id}>
                      <TableCell>
                        <Chip label={spec.symbol} size='small' />
                      </TableCell>
                      <TableCell>{spec.assetType}</TableCell>
                      <TableCell align='right'>
                        {spec.tickSize ?? '—'}
                      </TableCell>
                      <TableCell align='right'>
                        {spec.tickValue ?? '—'}
                      </TableCell>
                      <TableCell align='right'>
                        {spec.pointValue ?? '—'}
                      </TableCell>
                      <TableCell align='right'>
                        {spec.contractMultiplier}
                      </TableCell>
                      <TableCell>{spec.exchange || '—'}</TableCell>
                      <TableCell align='right'>
                        <IconButton
                          aria-label={`Edit ${spec.symbol}`}
                          onClick={() => onEdit(spec)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          aria-label={`Delete ${spec.symbol}`}
                          onClick={() => onDelete(spec)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Panel>
        </Box>
      )}

      <Typography variant='subtitle2' sx={{ mb: 2 }}>
        Built-in futures specifications
      </Typography>
      <Panel padding={0}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell align='right'>Tick size</TableCell>
                <TableCell align='right'>Tick value</TableCell>
                <TableCell align='right'>Point value</TableCell>
                <TableCell align='right'>Multiplier</TableCell>
                <TableCell>Exchange</TableCell>
                <TableCell>Timezone</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {specs.builtins.map((spec) => (
                <TableRow key={spec.symbol}>
                  <TableCell>
                    <Chip label={spec.symbol} size='small' />
                  </TableCell>
                  <TableCell align='right'>{spec.tickSize}</TableCell>
                  <TableCell align='right'>
                    {money(spec.tickValue, spec.currency)}
                  </TableCell>
                  <TableCell align='right'>{spec.pointValue}</TableCell>
                  <TableCell align='right'>{spec.contractMultiplier}</TableCell>
                  <TableCell>{spec.exchange}</TableCell>
                  <TableCell>{spec.timezone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Panel>
    </Box>
  );
}

export default function AccountsPage() {
  const [tab, setTab] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [specs, setSpecs] = useState({ builtins: [], custom: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [accountDialog, setAccountDialog] = useState(null);
  const [specDialog, setSpecDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountResult, specificationResult] = await Promise.all([
        accountApi.fetchAccounts({ activeOnly: false }),
        instrumentApi.fetchInstrumentSpecifications(),
      ]);
      setAccounts(accountResult);
      setSpecs(specificationResult);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || requestError.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts]
  );
  const archivedAccounts = useMemo(
    () => accounts.filter((account) => !account.isActive),
    [accounts]
  );

  const runAction = async (operation, message) => {
    setError(null);
    try {
      await operation();
      setToast(message);
      setConfirm(null);
      await load();
      setRefreshToken((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || requestError.message
      );
      setConfirm(null);
    }
  };

  const saveAccount = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      if (accountDialog?._id) {
        await accountApi.updateAccount(accountDialog._id, payload);
      } else {
        await accountApi.createAccount(payload);
      }
      setAccountDialog(null);
      setToast('Account saved');
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || requestError.message
      );
    } finally {
      setSaving(false);
    }
  };

  const saveSpecification = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      if (specDialog?._id) {
        await instrumentApi.updateInstrumentSpecification(
          specDialog._id,
          payload
        );
      } else {
        await instrumentApi.createInstrumentSpecification(payload);
      }
      setSpecDialog(null);
      setToast('Instrument specification saved');
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || requestError.message
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        label='Loading accounts and instruments…'
        skeletonRows={6}
      />
    );
  }
  if (error && accounts.length === 0) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Box>
      <PageHeader
        eyebrow='Trading configuration'
        title='Accounts & Instruments'
        description='Manage trading accounts and the contract specifications used by imports, reconstruction, P&L, risk, Replay, and Backtesting.'
        actions={
          <Button
            startIcon={<AddIcon />}
            variant='contained'
            onClick={() =>
              tab === 0 ? setAccountDialog({}) : setSpecDialog({})
            }
          >
            {tab === 0 ? 'Add account' : 'Add custom spec'}
          </Button>
        }
      />

      {error && (
        <Alert severity='error' onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {toast && (
        <Alert severity='success' onClose={() => setToast(null)} sx={{ mb: 3 }}>
          {toast}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab label='Accounts' />
        <Tab label='Instrument specifications' />
      </Tabs>

      {tab === 0 && (
        <Box>
          <SectionHeader
            title='Active accounts'
            description='Account ownership is enforced by the server. The default account is used by workflows that need a starting account context.'
          />
          <AccountsTable
            accounts={activeAccounts}
            expandedId={expandedId}
            onToggleExpanded={(id) =>
              setExpandedId((current) => (current === id ? null : id))
            }
            onEdit={setAccountDialog}
            onDefault={(account) =>
              runAction(
                () => accountApi.setDefaultAccount(account._id),
                'Default account updated'
              )
            }
            onArchive={(account) =>
              setConfirm({
                title: 'Archive account?',
                description:
                  'Archiving removes the account from normal selection but preserves its trades, imports, broker mappings, and history.',
                confirmLabel: 'Archive',
                onConfirm: () =>
                  runAction(
                    () => accountApi.archiveAccount(account._id),
                    'Account archived'
                  ),
              })
            }
            refreshToken={refreshToken}
          />
          <ArchivedAccounts
            accounts={archivedAccounts}
            onRestore={(account) =>
              runAction(
                () => accountApi.restoreAccount(account._id),
                'Account restored'
              )
            }
            onDelete={(account) =>
              setConfirm({
                title: 'Delete account permanently?',
                description:
                  'Deletion is allowed only when no trades reference this account. Archiving is safer for historical accounts.',
                confirmLabel: 'Delete',
                onConfirm: () =>
                  runAction(
                    () => accountApi.deleteAccount(account._id),
                    'Account deleted'
                  ),
              })
            }
          />
        </Box>
      )}

      {tab === 1 && (
        <InstrumentSpecifications
          specs={specs}
          onEdit={setSpecDialog}
          onDelete={(spec) =>
            setConfirm({
              title: 'Delete custom specification?',
              description:
                'The system specification will be used again if one exists. Historical trades keep their persisted multipliers.',
              confirmLabel: 'Delete',
              onConfirm: () =>
                runAction(
                  () => instrumentApi.deleteInstrumentSpecification(spec._id),
                  'Custom specification deleted'
                ),
            })
          }
        />
      )}

      <AccountDialog
        open={Boolean(accountDialog)}
        account={accountDialog?._id ? accountDialog : null}
        onClose={() => setAccountDialog(null)}
        onSave={saveAccount}
        saving={saving}
      />
      <SpecDialog
        open={Boolean(specDialog)}
        spec={specDialog?._id ? specDialog : null}
        onClose={() => setSpecDialog(null)}
        onSave={saveSpecification}
        saving={saving}
      />
      <ConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.title || ''}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm}
        onClose={() => setConfirm(null)}
      />
    </Box>
  );
}
