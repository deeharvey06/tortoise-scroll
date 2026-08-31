import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';

import * as analyticsApi from '../../services/analyticsService';
import * as tradeApi from '../../services/tradeService';
import { useFilterParams } from '../../store/useFilterStore';
import { palette } from '../../theme/theme';

function intensity(netPnL, maxAbs) {
  if (!maxAbs) return 0.15;
  return Math.min(0.85, 0.15 + (Math.abs(netPnL) / maxAbs) * 0.7);
}

export default function CalendarPage() {
  const params = useFilterParams();
  const [month, setMonth] = useState(new Date());
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dayDialog, setDayDialog] = useState(null); // { date, trades, loading }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    analyticsApi
      .fetchCalendarMonth(month.getFullYear(), month.getMonth() + 1, params)
      .then((d) => !cancelled && setDays(d.days))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, JSON.stringify(params)]);

  const dayMap = new Map(days.map((d) => [d.date, d]));
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const maxAbs = Math.max(0, ...days.map((d) => Math.abs(d.netPnL)));
  const monthNetPnL = days.reduce((sum, d) => sum + d.netPnL, 0);
  const monthTradeCount = days.reduce((sum, d) => sum + d.tradeCount, 0);

  const openDay = async (dateKey) => {
    setDayDialog({ date: dateKey, trades: [], loading: true });
    try {
      const dayStats = dayMap.get(dateKey);
      const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);
      const data = await tradeApi.fetchTrades({
        ...params,
        dateFrom: dayStart.toISOString(),
        dateTo: dayEnd.toISOString(),
        limit: 100,
      });
      setDayDialog({ date: dateKey, stats: dayStats, trades: data.items, loading: false });
    } catch (err) {
      setDayDialog({ date: dateKey, trades: [], loading: false, error: err.message });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" aria-label="Previous month" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h5" sx={{ minWidth: 180, textAlign: 'center' }}>
            {format(month, 'MMMM yyyy')}
          </Typography>
          <IconButton size="small" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
        {!loading && days.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {monthTradeCount} trades · Net{' '}
            <Box component="span" sx={{ color: monthNetPnL >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
              {monthNetPnL >= 0 ? '+' : ''}${monthNetPnL.toFixed(2)}
            </Box>
          </Typography>
        )}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Grid container spacing={1}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <Grid item xs={12 / 7} key={d}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                {d}
              </Typography>
            </Grid>
          ))}
          {gridDays.map((date) => {
            const key = format(date, 'yyyy-MM-dd');
            const stats = dayMap.get(key);
            const inMonth = isSameMonth(date, month);
            const bg = stats
              ? stats.netPnL >= 0
                ? `rgba(47, 214, 117, ${intensity(stats.netPnL, maxAbs)})`
                : `rgba(255, 92, 108, ${intensity(stats.netPnL, maxAbs)})`
              : 'transparent';
            return (
              <Grid item xs={12 / 7} key={key}>
                <Paper
                  onClick={() => stats && openDay(key)}
                  sx={{
                    height: 84,
                    p: 1,
                    backgroundColor: bg,
                    opacity: inMonth ? 1 : 0.35,
                    cursor: stats ? 'pointer' : 'default',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    '&:hover': stats ? { borderColor: 'primary.main' } : {},
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {format(date, 'd')}
                  </Typography>
                  {stats && (
                    <Box>
                      <Typography
                        variant="body2"
                        className="mono-data"
                        sx={{ fontWeight: 700, color: stats.netPnL >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {stats.netPnL >= 0 ? '+' : ''}
                        {stats.netPnL.toFixed(0)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {stats.tradeCount} trade{stats.tradeCount !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={!!dayDialog} onClose={() => setDayDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{dayDialog ? format(new Date(`${dayDialog.date}T00:00:00`), 'EEEE, MMMM d, yyyy') : ''}</DialogTitle>
        <DialogContent dividers>
          {dayDialog?.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} />
            </Box>
          ) : dayDialog?.stats ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Net P&L
                  </Typography>
                  <Typography sx={{ color: dayDialog.stats.netPnL >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}>
                    ${dayDialog.stats.netPnL.toFixed(2)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Win rate
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{dayDialog.stats.winRate}%</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Avg R
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    {dayDialog.stats.avgR !== null ? `${dayDialog.stats.avgR.toFixed(2)}R` : '—'}
                  </Typography>
                </Grid>
              </Grid>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol</TableCell>
                    <TableCell>Dir</TableCell>
                    <TableCell align="right">Net P&L</TableCell>
                    <TableCell align="right">R</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dayDialog.trades.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell>{t.symbol}</TableCell>
                      <TableCell>{t.direction}</TableCell>
                      <TableCell align="right" sx={{ color: t.netPnL >= 0 ? 'success.main' : 'error.main' }}>
                        {t.netPnL !== null ? `$${t.netPnL.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell align="right">{t.rMultiple !== null && t.rMultiple !== undefined ? `${t.rMultiple.toFixed(2)}R` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data for this day.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
