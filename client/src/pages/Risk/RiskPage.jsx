import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';

import * as riskApi from '../../services/riskService';
import { useFilterStore } from '../../store/useFilterStore';
import KpiCard from '../../components/KpiCard';
import PageHeader from '../../components/PageHeader';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  SectionHeader,
  StatusBadge,
} from '../../components/ui';

const LIMIT_FIELDS = [
  ['maxDailyLoss', 'Max daily loss ($)'],
  ['maxWeeklyLoss', 'Max weekly loss ($)'],
  ['maxPositionSize', 'Max position size (shares/contracts)'],
  ['maxTradesPerDay', 'Max trades per day'],
  ['maxConsecutiveLosses', 'Max consecutive losses'],
  ['maxRiskPerTrade', 'Max risk per trade ($)'],
];

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function LimitBar({
  label,
  current,
  limit,
  formatValue = (value) => Math.abs(value).toFixed(2),
}) {
  if (limit === null || limit === undefined) return null;
  const pct =
    Math.abs(limit) === 0
      ? 100
      : Math.min(100, (Math.abs(current) / Math.abs(limit)) * 100);
  const danger = pct >= 100;
  const warn = pct >= 80;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant='body2'>{label}</Typography>
        <Typography
          variant='body2'
          className='mono-data'
          color={
            danger ? 'error.main' : warn ? 'warning.main' : 'text.secondary'
          }
        >
          {formatValue(current)} / {formatValue(limit)} · {pct.toFixed(0)}%
        </Typography>
      </Box>
      <LinearProgress
        variant='determinate'
        value={pct}
        color={danger ? 'error' : warn ? 'warning' : 'primary'}
        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
      />
    </Box>
  );
}

export default function RiskPage() {
  const { accountId } = useFilterStore();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await riskApi.fetchRiskDashboard(accountId || undefined);
      setDashboard(data);
      setForm({
        maxDailyLoss: data.settings?.maxDailyLoss ?? '',
        maxWeeklyLoss: data.settings?.maxWeeklyLoss ?? '',
        maxPositionSize: data.settings?.maxPositionSize ?? '',
        maxTradesPerDay: data.settings?.maxTradesPerDay ?? '',
        maxConsecutiveLosses: data.settings?.maxConsecutiveLosses ?? '',
        maxRiskPerTrade: data.settings?.maxRiskPerTrade ?? '',
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = { accountId: accountId || null };
      for (const [key] of LIMIT_FIELDS) {
        payload[key] = form[key] === '' ? null : Number(form[key]);
      }

      await riskApi.saveRiskSettings(payload);
      setToast('Risk limits saved');
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label='Loading risk controls…' skeletonRows={5} />;
  }
  if (error && !dashboard) return <ErrorState message={error} onRetry={load} />;

  const current = dashboard?.current;
  const dailyLimit = dashboard?.settings?.maxDailyLoss;
  const dailyLossUsed = current.dailyPnL < 0 ? Math.abs(current.dailyPnL) : 0;
  const dailyRemaining =
    dailyLimit == null
      ? null
      : Math.max(0, Math.abs(dailyLimit) - dailyLossUsed);
  const hasWarnings = dashboard?.warnings?.length > 0;

  return (
    <Box>
      <PageHeader
        eyebrow='Capital protection'
        title='Risk'
        description={
          accountId
            ? 'Showing limits and exposure for the account selected in the filter bar.'
            : 'Showing global limits and exposure across all accounts. Select an account for account-specific controls.'
        }
        actions={
          <StatusBadge
            label={
              hasWarnings
                ? `${dashboard.warnings.length} attention item${dashboard.warnings.length === 1 ? '' : 's'}`
                : 'Within configured limits'
            }
            tone={hasWarnings ? 'warning' : 'positive'}
          />
        }
      />

      {error && (
        <ErrorState
          compact
          message={error}
          onClose={() => setError(null)}
          sx={{ mb: 4 }}
        />
      )}
      {toast && (
        <Alert severity='success' onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast}
        </Alert>
      )}

      {dashboard?.warnings?.length > 0 && (
        <Box sx={{ mb: 4 }}>
          {dashboard.warnings.map((w, i) => (
            <Alert severity='warning' key={i} sx={{ mb: 1 }}>
              {w}
            </Alert>
          ))}
        </Box>
      )}

      <Grid container spacing={1.5} sx={{ mb: 5 }}>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label="Today's P&L"
            value={fmtMoney(current.dailyPnL)}
            colorByValue
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label='Daily risk remaining'
            value={
              dailyRemaining == null
                ? 'Not configured'
                : fmtMoney(dailyRemaining)
            }
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label="This week's P&L"
            value={fmtMoney(current.weeklyPnL)}
            colorByValue
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label='Current drawdown'
            value={fmtMoney(current.currentDrawdown)}
            colorByValue
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label='Max drawdown'
            value={fmtMoney(current.maxDrawdown)}
            colorByValue
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label='Consecutive losses'
            value={current.consecutiveLosses}
          />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard label='Trades today' value={current.tradesToday} />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard label='Open positions' value={current.openPositions} />
        </Grid>
        <Grid item xs={6} sm={4} lg={3}>
          <KpiCard
            label='Current exposure'
            value={fmtMoney(current.currentExposure)}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              eyebrow='Utilization'
              title='Limits vs. current usage'
              description='Warnings strengthen only as usage approaches or reaches a configured limit.'
            />
            <LimitBar
              label='Daily loss'
              current={current.dailyPnL}
              limit={dashboard.settings?.maxDailyLoss}
            />
            <LimitBar
              label='Weekly loss'
              current={current.weeklyPnL}
              limit={dashboard.settings?.maxWeeklyLoss}
            />
            <LimitBar
              label='Trades today'
              current={current.tradesToday}
              limit={dashboard.settings?.maxTradesPerDay}
              formatValue={(value) => Math.abs(value).toFixed(0)}
            />
            <LimitBar
              label='Consecutive losses'
              current={current.consecutiveLosses}
              limit={dashboard.settings?.maxConsecutiveLosses}
              formatValue={(value) => Math.abs(value).toFixed(0)}
            />
            {!dashboard.settings?.maxDailyLoss &&
              !dashboard.settings?.maxWeeklyLoss &&
              !dashboard.settings?.maxTradesPerDay &&
              !dashboard.settings?.maxConsecutiveLosses && (
                <EmptyState
                  compact
                  title='No limits configured'
                  description='Set limits to see live utilization and threshold warnings.'
                />
              )}
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel>
            <SectionHeader
              eyebrow='Policy'
              title='Configure limits'
              description='Define the boundaries that protect capital and decision quality.'
            />
            <Grid container spacing={2}>
              {LIMIT_FIELDS.map(([key, label]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <TextField
                    label={label}
                    type='number'
                    fullWidth
                    size='small'
                    value={form[key] ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant='contained'
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <CircularProgress size={18} /> : 'Save limits'}
              </Button>
            </Box>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
