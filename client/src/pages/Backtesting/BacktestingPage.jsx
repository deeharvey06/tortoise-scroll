import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { format } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip } from 'recharts';

import * as backtestApi from '../../services/backtestService';
import { palette } from '../../theme/theme';
import KpiCard from '../../components/KpiCard';
import { ConfirmationDialog } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { EmptyState, LoadingState, Panel } from '../../components/ui';

const emptyForm = {
  name: '',
  symbol: '',
  timeframe: '1d',
  dateFrom: format(new Date(Date.now() - 90 * 86400000), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
  direction: 'long',
  fastPeriod: 10,
  slowPeriod: 30,
  stopLossPct: '',
  takeProfitPct: '',
  positionSize: 1,
  commission: 0,
  slippage: 0,
};

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

export default function BacktestingPage() {
  const [status, setStatus] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [resultView, setResultView] = useState(null); // { config, result }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([backtestApi.fetchBacktestStatus(), backtestApi.fetchConfigs()]);
      setStatus(s);
      setConfigs(c);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      symbol: c.symbol,
      timeframe: c.timeframe,
      dateFrom: format(new Date(c.dateFrom), 'yyyy-MM-dd'),
      dateTo: format(new Date(c.dateTo), 'yyyy-MM-dd'),
      direction: c.direction,
      fastPeriod: c.entryRule.fastPeriod,
      slowPeriod: c.entryRule.slowPeriod,
      stopLossPct: c.stopLossPct ?? '',
      takeProfitPct: c.takeProfitPct ?? '',
      positionSize: c.positionSize,
      commission: c.commission,
      slippage: c.slippage,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      timeframe: form.timeframe,
      dateFrom: new Date(form.dateFrom).toISOString(),
      dateTo: new Date(form.dateTo).toISOString(),
      direction: form.direction,
      entryRule: { type: 'smaCrossover', fastPeriod: Number(form.fastPeriod), slowPeriod: Number(form.slowPeriod) },
      stopLossPct: form.stopLossPct === '' ? null : Number(form.stopLossPct),
      takeProfitPct: form.takeProfitPct === '' ? null : Number(form.takeProfitPct),
      positionSize: Number(form.positionSize),
      commission: Number(form.commission),
      slippage: Number(form.slippage),
    };
    try {
      if (editing) {
        await backtestApi.updateConfig(editing._id, payload);
      } else {
        await backtestApi.createConfig(payload);
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const confirmDelete = async () => {
    try {
      await backtestApi.deleteConfig(deleteTarget._id);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    }
  };

  const handleRun = async (config) => {
    setRunningId(config._id);
    setError(null);
    try {
      const result = await backtestApi.runConfig(config._id);
      setResultView({ config, result });
      load();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setRunningId(null);
    }
  };

  if (loading) {
    return (
      <LoadingState label="Loading backtests" />
    );
  }

  return (
    <Box>
      <PageHeader eyebrow="Tools" title="Backtesting" description="Define and evaluate repeatable rules against connected historical market data." actions={<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          New backtest
        </Button>} />

      {!status?.configured && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No market-data provider is connected, so backtests can't run against real historical prices yet. You can
          still define and save configurations below — they'll run the moment a provider is set up in{' '}
          <code>server/.env</code>. The simulation engine itself (SMA crossover with stop/target/commission/
          slippage) is fully built and unit-tested against synthetic data.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {configs.length === 0 ? (
        <EmptyState title="No saved backtests" description="Define your first rules-based test when you are ready." action={<Button variant="contained" size="small" onClick={openCreate}>New backtest</Button>} />
      ) : (
        <Panel padding={0} sx={{ overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Rule</TableCell>
                <TableCell>Date range</TableCell>
                <TableCell align="right">Last result</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((c) => (
                <TableRow key={c._id} hover>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.symbol}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`SMA ${c.entryRule.fastPeriod}/${c.entryRule.slowPeriod} · ${c.direction}`}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell className="mono-data">
                    {format(new Date(c.dateFrom), 'MM/dd/yy')} – {format(new Date(c.dateTo), 'MM/dd/yy')}
                  </TableCell>
                  <TableCell align="right" className="mono-data">
                    {c.lastResult ? (
                      <Box
                        component="span"
                        sx={{ color: c.lastResult.summary.netPnL >= 0 ? 'success.main' : 'error.main', cursor: 'pointer' }}
                        onClick={() => setResultView({ config: c, result: c.lastResult })}
                      >
                        {fmtMoney(c.lastResult.summary.netPnL)}
                      </Box>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={status?.configured ? 'Run backtest' : 'Connect a market data provider to run'}>
                      <span>
                        <IconButton size="small" aria-label="Run backtest" onClick={() => handleRun(c)} disabled={!status?.configured || runningId === c._id}>
                          {runningId === c._id ? <CircularProgress size={16} /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <IconButton size="small" aria-label="Edit backtest" onClick={() => openEdit(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete backtest" onClick={() => setDeleteTarget(c)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit backtest' : 'New backtest'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField label="Name" fullWidth size="small" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Symbol" fullWidth size="small" required value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField select label="Timeframe" fullWidth size="small" value={form.timeframe} onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))}>
                {['1m', '5m', '15m', '1h', '1d'].map((tf) => (
                  <MenuItem key={tf} value={tf}>
                    {tf}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField type="date" label="From" fullWidth size="small" InputLabelProps={{ shrink: true }} value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField type="date" label="To" fullWidth size="small" InputLabelProps={{ shrink: true }} value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField select label="Direction" fullWidth size="small" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
                <MenuItem value="long">Long</MenuItem>
                <MenuItem value="short">Short</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={4}>
              <TextField type="number" label="Fast SMA period" fullWidth size="small" value={form.fastPeriod} onChange={(e) => setForm((f) => ({ ...f, fastPeriod: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField type="number" label="Slow SMA period" fullWidth size="small" value={form.slowPeriod} onChange={(e) => setForm((f) => ({ ...f, slowPeriod: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField type="number" label="Stop loss %" fullWidth size="small" value={form.stopLossPct} onChange={(e) => setForm((f) => ({ ...f, stopLossPct: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField type="number" label="Take profit %" fullWidth size="small" value={form.takeProfitPct} onChange={(e) => setForm((f) => ({ ...f, takeProfitPct: e.target.value }))} />
            </Grid>
            <Grid item xs={4}>
              <TextField type="number" label="Position size" fullWidth size="small" value={form.positionSize} onChange={(e) => setForm((f) => ({ ...f, positionSize: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField type="number" label="Commission per side ($)" fullWidth size="small" value={form.commission} onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField type="number" label="Slippage per fill ($)" fullWidth size="small" value={form.slippage} onChange={(e) => setForm((f) => ({ ...f, slippage: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.symbol}>
            {editing ? 'Save changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete backtest?"
        description={`This permanently deletes "${deleteTarget?.name || ''}". This cannot be undone.`}
        confirmLabel="Delete backtest"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Dialog open={!!resultView} onClose={() => setResultView(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{resultView?.config.name} — result</DialogTitle>
        <DialogContent dividers>
          {resultView && (
            <>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                  <KpiCard label="Net P&L" value={fmtMoney(resultView.result.summary.netPnL)} colorByValue />
                </Grid>
                <Grid item xs={4}>
                  <KpiCard label="Win rate" value={resultView.result.summary.winRate} suffix="%" />
                </Grid>
                <Grid item xs={4}>
                  <KpiCard label="Trades" value={resultView.result.summary.totalTrades} />
                </Grid>
                <Grid item xs={4}>
                  <KpiCard label="Profit factor" value={resultView.result.summary.profitFactor} />
                </Grid>
                <Grid item xs={4}>
                  <KpiCard label="Expectancy" value={fmtMoney(resultView.result.summary.expectancy)} colorByValue />
                </Grid>
                <Grid item xs={4}>
                  <KpiCard label="Max drawdown" value={fmtMoney(resultView.result.summary.maxDrawdown)} colorByValue />
                </Grid>
              </Grid>
              {resultView.result.equityCurve?.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={resultView.result.equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                    <XAxis dataKey="time" tick={{ fontSize: 9 }} tickFormatter={(t) => format(new Date(t), 'MM/dd')} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip labelFormatter={(t) => format(new Date(t), 'PPp')} />
                    <Line type="monotone" dataKey="equity" stroke={palette.accent.main} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
