import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  ConfirmationDialog,
  EmptyState,
  Panel,
  SectionHeader,
} from '@/components/ui';
import * as brokerApi from '@/services/brokerConnectionService';

const labelForStatus = (value) =>
  ({
    connecting: 'Connecting',
    connected: 'Up to date',
    syncing: 'Syncing',
    attention_required: 'Attention required',
    authorization_expired: 'Authorization expired',
    rate_limited: 'Rate limited',
    provider_unavailable: 'Provider unavailable',
    disconnected: 'Disconnected',
  })[value] || value;

function MappingRow({ brokerAccount, accounts, current, onMap, busy }) {
  const [accountId, setAccountId] = useState(current?.accountId || '');
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ sm: 'center' }}
      sx={{ py: 1 }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography variant='body2' fontWeight={600}>
          {brokerAccount.providerAccountName || 'Broker account'}
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {brokerAccount.providerAccountNumberMasked ||
            brokerAccount.providerAccountId}
        </Typography>
      </Box>
      <TextField
        select
        size='small'
        label='Tortoise Scroll account'
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        sx={{ minWidth: 240 }}
      >
        <MenuItem value=''>Select account</MenuItem>
        {accounts.map((a) => (
          <MenuItem key={a._id} value={a._id}>
            {a.name}
          </MenuItem>
        ))}
      </TextField>
      <Button
        size='small'
        variant='outlined'
        disabled={!accountId || busy}
        onClick={() => onMap(brokerAccount.providerAccountId, accountId)}
      >
        Map
      </Button>
    </Stack>
  );
}

export default function BrokerConnectionsTab({ accounts = [] }) {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [discovered, setDiscovered] = useState({});
  const [history, setHistory] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [disconnectTarget, setDisconnectTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        brokerApi.fetchProviders(),
        brokerApi.fetchConnections(),
      ]);
      setProviders(p);
      setConnections(c);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async (provider) => {
    setBusy(`connect:${provider}`);
    setError('');
    try {
      const result = await brokerApi.beginConnection(provider);
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
      setBusy('');
    }
  };

  const reconnect = async (id) => {
    setBusy(`reconnect:${id}`);
    setError('');
    try {
      const result = await brokerApi.reconnect(id);
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
      setBusy('');
    }
  };

  const inspect = async (id) => {
    setBusy(`inspect:${id}`);
    setError('');
    try {
      const [a, h] = await Promise.all([
        brokerApi.fetchBrokerAccounts(id),
        brokerApi.fetchSyncHistory(id),
      ]);
      setDiscovered((v) => ({ ...v, [id]: a }));
      setHistory((v) => ({ ...v, [id]: h }));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusy('');
    }
  };

  const map = async (connectionId, providerAccountId, accountId) => {
    setBusy(`map:${connectionId}`);
    try {
      await brokerApi.mapBrokerAccount(
        connectionId,
        providerAccountId,
        accountId
      );

      const result = await brokerApi.syncNow(connectionId);
      setNotice(
        `Broker account mapped and initial sync completed: ${result.summary?.executionsInserted || 0} new executions.`
      );

      await load();
      await inspect(connectionId);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusy('');
    }
  };

  const sync = async (id) => {
    setBusy(`sync:${id}`);
    setError('');

    try {
      const result = await brokerApi.syncNow(id);
      setNotice(
        `Sync complete: ${result.summary?.executionsInserted || 0} new executions, ${result.summary?.duplicates || 0} duplicates.`
      );
      await load();
      await inspect(id);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusy('');
    }
  };

  const confirmDisconnect = async () => {
    const id = disconnectTarget?._id;
    if (!id) return;
    setBusy(`disconnect:${id}`);
    try {
      await brokerApi.disconnect(id);
      setNotice(
        'Broker disconnected. Historical executions, trades, and journal data were preserved.'
      );
      setDisconnectTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Box sx={{ maxWidth: 920 }}>
      {error && (
        <Alert severity='error' onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity='success' onClose={() => setNotice('')} sx={{ mb: 2 }}>
          {notice}
        </Alert>
      )}
      <Panel sx={{ mb: 2 }}>
        <SectionHeader
          title='Broker connections'
          description='Read-only synchronization imports brokerage executions into the same ledger and reconstruction engine used by CSV imports.'
        />
        <Alert severity='info' sx={{ mb: 2 }}>
          Broker connections are read-only for journaling and analytics.
          Tortoise Scroll never submits, modifies, or cancels orders.
        </Alert>
        <Stack direction='row' spacing={1} flexWrap='wrap'>
          {providers.map((provider) => {
            const active = connections.some(
              (c) => c.provider === provider.key && c.status !== 'disconnected'
            );
            return (
              <Button
                key={provider.key}
                variant='outlined'
                disabled={active || busy === `connect:${provider.key}`}
                onClick={() => connect(provider.key)}
              >
                {busy === `connect:${provider.key}` ? (
                  <CircularProgress size={16} />
                ) : active ? (
                  `${provider.label} connected`
                ) : (
                  `Connect ${provider.label}`
                )}
              </Button>
            );
          })}
        </Stack>
      </Panel>

      {connections.length === 0 ? (
        <EmptyState
          title='No connected brokers'
          description='Connect a supported broker to synchronize executions automatically.'
        />
      ) : (
        connections.map((connection) => {
          const brokerAccounts =
            discovered[connection._id] ||
            connection.providerMetadata?.discoveredAccounts ||
            [];
          const runs = history[connection._id] || [];
          return (
            <Panel key={connection._id} sx={{ mb: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent='space-between'
                spacing={2}
              >
                <Box>
                  <Typography variant='h6'>
                    {connection.provider === 'thinkorswim'
                      ? 'Thinkorswim / Schwab'
                      : connection.provider}
                  </Typography>
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    sx={{ mt: 0.5 }}
                  >
                    <Chip
                      size='small'
                      label={labelForStatus(connection.status)}
                    />
                    <Typography variant='caption' color='text.secondary'>
                      Last sync{' '}
                      {connection.lastSuccessfulSyncAt
                        ? new Date(
                            connection.lastSuccessfulSyncAt
                          ).toLocaleString()
                        : 'Never'}
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction='row' spacing={1}>
                  <Button
                    size='small'
                    onClick={() => inspect(connection._id)}
                    disabled={Boolean(busy)}
                  >
                    Manage
                  </Button>
                  {['authorization_expired', 'attention_required'].includes(
                    connection.status
                  ) && (
                    <Button
                      size='small'
                      variant='outlined'
                      onClick={() => reconnect(connection._id)}
                      disabled={Boolean(busy)}
                    >
                      Reconnect
                    </Button>
                  )}
                  <Button
                    size='small'
                    variant='contained'
                    onClick={() => sync(connection._id)}
                    disabled={
                      Boolean(busy) ||
                      connection.accountMappings.length === 0 ||
                      connection.status === 'authorization_expired'
                    }
                  >
                    {busy === `sync:${connection._id}` ? (
                      <CircularProgress size={16} />
                    ) : (
                      'Sync Now'
                    )}
                  </Button>
                  <Button
                    size='small'
                    color='error'
                    onClick={() => setDisconnectTarget(connection)}
                    disabled={Boolean(busy)}
                  >
                    Disconnect
                  </Button>
                </Stack>
              </Stack>
              {connection.lastError?.message && (
                <Alert severity='warning' sx={{ mt: 2 }}>
                  {connection.lastError.message}
                </Alert>
              )}
              {brokerAccounts.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 1 }} />
                  <SectionHeader
                    title='Account mapping'
                    description='Each brokerage account maps explicitly to one account owned by you.'
                  />
                  {brokerAccounts.map((a) => (
                    <MappingRow
                      key={a.providerAccountId}
                      brokerAccount={a}
                      accounts={accounts}
                      current={connection.accountMappings.find(
                        (m) => m.providerAccountId === a.providerAccountId
                      )}
                      onMap={(providerAccountId, accountId) =>
                        map(connection._id, providerAccountId, accountId)
                      }
                      busy={Boolean(busy)}
                    />
                  ))}
                </Box>
              )}
              {runs.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 2 }} />
                  <SectionHeader title='Sync history' />
                  {runs.slice(0, 10).map((run) => (
                    <Box key={run._id} sx={{ py: 1 }}>
                      <Typography variant='body2'>
                        {new Date(run.startedAt).toLocaleString()} ·{' '}
                        {run.syncType} · {run.status}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {run.summary?.recordsFetched || 0} checked ·{' '}
                        {run.summary?.executionsInserted || 0} new ·{' '}
                        {run.summary?.duplicates || 0} duplicates ·{' '}
                        {run.summary?.tradesReconstructed || 0} trades ·{' '}
                        {run.summary?.errors || 0} errors
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Panel>
          );
        })
      )}

      <ConfirmationDialog
        open={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={confirmDisconnect}
        title='Disconnect broker?'
        confirmLabel='Disconnect'
        description='Future synchronization will stop. Historical executions, reconstructed trades, and journal data will be preserved.'
      />
    </Box>
  );
}
