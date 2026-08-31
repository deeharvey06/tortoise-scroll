import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';

import * as riskApi from '../../services/riskService';
import { useFilterStore } from '../../store/useFilterStore';
import KpiCard from '../../components/KpiCard';

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

function LimitBar({ label, current, limit, invert }) {
  if (limit === null || limit === undefined) return null;
  const pct = Math.min(100, (Math.abs(current) / Math.abs(limit)) * 100);
  const danger = pct >= 100;
  const warn = pct >= 80;
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" className="mono-data" color={danger ? 'error.main' : warn ? 'warning.main' : 'text.secondary'}>
          {Math.abs(current).toFixed(2)} / {Math.abs(limit)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={danger ? 'error' : warn ? 'warning' : 'primary'}
        sx={{ height: 8, borderRadius: 4 }}
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
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const current = dashboard?.current;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Risk
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {accountId
          ? 'Showing limits and exposure for the account selected in the filter bar.'
          : 'Showing global limits and exposure across all accounts — select an account in the filter bar for account-specific limits.'}
      </Typography>

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

      {dashboard?.warnings?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {dashboard.warnings.map((w, i) => (
            <Alert severity="warning" key={i} sx={{ mb: 1 }}>
              {w}
            </Alert>
          ))}
        </Box>
      )}

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Today's P&L" value={fmtMoney(current.dailyPnL)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="This week's P&L" value={fmtMoney(current.weeklyPnL)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Current drawdown" value={fmtMoney(current.currentDrawdown)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Max drawdown" value={fmtMoney(current.maxDrawdown)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Consecutive losses" value={current.consecutiveLosses} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Trades today" value={current.tradesToday} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Open positions" value={current.openPositions} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Current exposure" value={fmtMoney(current.currentExposure)} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Limits vs. current usage
            </Typography>
            <LimitBar label="Daily loss" current={current.dailyPnL} limit={dashboard.settings?.maxDailyLoss} />
            <LimitBar label="Weekly loss" current={current.weeklyPnL} limit={dashboard.settings?.maxWeeklyLoss} />
            <LimitBar label="Trades today" current={current.tradesToday} limit={dashboard.settings?.maxTradesPerDay} />
            <LimitBar label="Consecutive losses" current={current.consecutiveLosses} limit={dashboard.settings?.maxConsecutiveLosses} />
            {!dashboard.settings?.maxDailyLoss &&
              !dashboard.settings?.maxWeeklyLoss &&
              !dashboard.settings?.maxTradesPerDay &&
              !dashboard.settings?.maxConsecutiveLosses && (
                <Typography variant="body2" color="text.secondary">
                  No limits configured yet — set them on the right to see live usage bars here.
                </Typography>
              )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              Configure limits
            </Typography>
            <Grid container spacing={2}>
              {LIMIT_FIELDS.map(([key, label]) => (
                <Grid item xs={12} sm={6} key={key}>
                  <TextField
                    label={label}
                    type="number"
                    fullWidth
                    size="small"
                    value={form[key] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? <CircularProgress size={18} /> : 'Save limits'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
