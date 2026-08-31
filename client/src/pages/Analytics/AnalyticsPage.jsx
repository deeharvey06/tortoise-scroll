import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import * as analyticsApi from '../../services/analyticsService';
import { useFilterParams } from '../../store/useFilterStore';

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function BreakdownTable({ title, rows }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No closed trades in this range.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{title.replace('P&L by ', '')}</TableCell>
              <TableCell align="right">Trades</TableCell>
              <TableCell align="right">Win rate</TableCell>
              <TableCell align="right">Avg R</TableCell>
              <TableCell align="right">Profit factor</TableCell>
              <TableCell align="right">Net P&L</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} hover>
                <TableCell>{r.label}</TableCell>
                <TableCell align="right" className="mono-data">
                  {r.count}
                </TableCell>
                <TableCell align="right" className="mono-data">
                  {r.winRate !== null ? `${r.winRate}%` : '—'}
                </TableCell>
                <TableCell align="right" className="mono-data">
                  {r.avgR !== null ? `${r.avgR.toFixed(2)}R` : '—'}
                </TableCell>
                <TableCell align="right" className="mono-data">
                  {r.profitFactor !== null ? r.profitFactor.toFixed(2) : '—'}
                </TableCell>
                <TableCell
                  align="right"
                  className="mono-data"
                  sx={{ color: r.netPnL >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
                >
                  {fmtMoney(r.netPnL)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

export default function AnalyticsPage() {
  const params = useFilterParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyticsApi
      .fetchDashboard(params)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Analytics
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every row below is a real group of your own closed trades — sample size (Trades column) is shown so you can
        judge how much weight a pattern deserves before you rely on it.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by symbol" rows={data.bySymbol} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by setup" rows={data.bySetup} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by session" rows={data.bySession} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by direction" rows={data.byDirection} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by day of week" rows={data.byDayOfWeek} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by hour (entry, UTC)" rows={data.byHour} />
        </Grid>
      </Grid>
    </Box>
  );
}
