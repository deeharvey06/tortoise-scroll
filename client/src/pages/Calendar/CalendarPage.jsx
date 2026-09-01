import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
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
import * as journalApi from '../../services/journalService';
import { useFilterParams } from '../../store/useFilterStore';
import PageHeader from '../../components/PageHeader';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  Panel,
  ProfitLossValue,
  RMultiple,
  StatusBadge,
  TradeDirection,
} from '../../components/ui';

function intensity(netPnL, maxAbs) {
  if (!maxAbs) return 10;
  return Math.min(28, 10 + (Math.abs(netPnL) / maxAbs) * 18);
}

export default function CalendarPage() {
  const navigate = useNavigate();
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
      .catch(
        (err) =>
          !cancelled &&
          setError(err.response?.data?.error?.message || err.message),
      )
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
    setDayDialog({ date: dateKey, trades: [], entries: [], loading: true });
    try {
      const dayStats = dayMap.get(dateKey);
      const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);
      const [data, entries] = await Promise.all([
        tradeApi.fetchTrades({
          ...params,
          dateFrom: dayStart.toISOString(),
          dateTo: dayEnd.toISOString(),
          limit: 100,
        }),
        journalApi.fetchEntries({
          dateFrom: dayStart.toISOString(),
          dateTo: dayEnd.toISOString(),
        }),
      ]);
      setDayDialog({
        date: dateKey,
        stats: dayStats,
        trades: data.items,
        entries,
        loading: false,
      });
    } catch (err) {
      setDayDialog({
        date: dateKey,
        trades: [],
        entries: [],
        loading: false,
        error: err.message,
      });
    }
  };

  return (
    <Box>
      <PageHeader
        eyebrow='Trading history'
        title='Trading Calendar'
        description='A month-by-month view of performance, activity, and the journal record behind each session.'
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size='small'
              aria-label='Previous month'
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography
              variant='h6'
              className='mono-data'
              sx={{ minWidth: 160, textAlign: 'center' }}
            >
              {format(month, 'MMMM yyyy')}
            </Typography>
            <IconButton
              size='small'
              aria-label='Next month'
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        }
      />

      {error && <ErrorState compact message={error} sx={{ mb: 4 }} />}

      {!loading && days.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <MetricCard
              label='Monthly net P&L'
              value={`${monthNetPnL >= 0 ? '+' : '−'}$${Math.abs(monthNetPnL).toFixed(2)}`}
              tone={
                monthNetPnL > 0
                  ? 'positive'
                  : monthNetPnL < 0
                    ? 'negative'
                    : undefined
              }
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <MetricCard
              label='Trades'
              value={monthTradeCount}
              supportingText={`${days.length} active trading day${days.length === 1 ? '' : 's'}`}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <MetricCard
              label='Average trades / day'
              value={(monthTradeCount / days.length).toFixed(1)}
            />
          </Grid>
        </Grid>
      )}

      {loading ? (
        <LoadingState label='Loading calendar…' skeletonRows={5} />
      ) : (
        <Panel padding={2}>
          <Grid container spacing={0.75}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Grid item xs={12 / 7} key={d}>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ display: 'block', textAlign: 'center' }}
                >
                  {d}
                </Typography>
              </Grid>
            ))}
            {gridDays.map((date) => {
              const key = format(date, 'yyyy-MM-dd');
              const stats = dayMap.get(key);
              const inMonth = isSameMonth(date, month);
              const strength = intensity(stats?.netPnL || 0, maxAbs);
              const bg = stats
                ? `color-mix(in srgb, var(--ts-financial-${stats.netPnL >= 0 ? 'positive' : 'negative'}) ${strength}%, transparent)`
                : 'transparent';
              return (
                <Grid item xs={12 / 7} key={key}>
                  <Paper
                    onClick={() => stats && openDay(key)}
                    sx={{
                      minHeight: { xs: 72, sm: 104 },
                      width: '100%',
                      p: { xs: 0.75, sm: 1.25 },
                      backgroundColor: bg,
                      opacity: inMonth ? 1 : 0.35,
                      cursor: stats ? 'pointer' : 'default',
                      display: 'flex',
                      color: 'text.primary',
                      textAlign: 'left',
                      font: 'inherit',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      '&:hover': stats
                        ? {
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                          }
                        : {},
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                    component={stats ? 'button' : 'div'}
                    type={stats ? 'button' : undefined}
                    aria-label={
                      stats
                        ? `${format(date, 'MMMM d')}: ${stats.tradeCount} trades, ${stats.netPnL >= 0 ? 'profit' : 'loss'} ${Math.abs(stats.netPnL).toFixed(2)}`
                        : undefined
                    }
                  >
                    <Typography variant='caption' color='text.secondary'>
                      {format(date, 'd')}
                    </Typography>
                    {stats && (
                      <Box>
                        <Typography
                          variant='body2'
                          className='mono-data'
                          sx={{
                            fontWeight: 700,
                            color:
                              stats.netPnL >= 0 ? 'success.main' : 'error.main',
                          }}
                        >
                          {stats.netPnL >= 0 ? '+' : '−'}$
                          {Math.abs(stats.netPnL).toFixed(0)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {stats.tradeCount} trade
                          {stats.tradeCount !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Panel>
      )}

      <Dialog
        open={!!dayDialog}
        onClose={() => setDayDialog(null)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>
          {dayDialog
            ? format(
                new Date(`${dayDialog.date}T00:00:00`),
                'EEEE, MMMM d, yyyy',
              )
            : ''}
        </DialogTitle>
        <DialogContent dividers>
          {dayDialog?.loading ? (
            <LoadingState compact label='Loading session…' />
          ) : dayDialog?.error ? (
            <ErrorState compact message={dayDialog.error} />
          ) : dayDialog?.stats ? (
            <>
              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={4}>
                  <MetricCard
                    label='Net P&L'
                    value={`${dayDialog.stats.netPnL >= 0 ? '+' : '−'}$${Math.abs(dayDialog.stats.netPnL).toFixed(2)}`}
                    tone={
                      dayDialog.stats.netPnL > 0
                        ? 'positive'
                        : dayDialog.stats.netPnL < 0
                          ? 'negative'
                          : undefined
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <MetricCard
                    label='Win rate'
                    value={`${dayDialog.stats.winRate}%`}
                    supportingText={`${dayDialog.stats.tradeCount} trade${dayDialog.stats.tradeCount === 1 ? '' : 's'}`}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <MetricCard
                    label='Average R'
                    value={
                      dayDialog.stats.avgR !== null
                        ? `${dayDialog.stats.avgR.toFixed(2)}R`
                        : '—'
                    }
                    tone={
                      dayDialog.stats.avgR > 0
                        ? 'positive'
                        : dayDialog.stats.avgR < 0
                          ? 'negative'
                          : undefined
                    }
                  />
                </Grid>
              </Grid>
              <Typography variant='overline' color='text.secondary'>
                Session trades
              </Typography>
              <TableContainer
                sx={{
                  mt: 1,
                  mb: 4,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Dir</TableCell>
                      <TableCell>Session</TableCell>
                      <TableCell align='right'>Net P&L</TableCell>
                      <TableCell align='right'>R</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dayDialog.trades.map((t) => (
                      <TableRow
                        key={t._id}
                        hover
                        onClick={() => navigate(`/trades/${t._id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t.symbol}
                        </TableCell>
                        <TableCell>
                          <TradeDirection direction={t.direction} />
                        </TableCell>
                        <TableCell>{t.session || '—'}</TableCell>
                        <TableCell align='right'>
                          <ProfitLossValue value={t.netPnL} />
                        </TableCell>
                        <TableCell align='right'>
                          <RMultiple value={t.rMultiple} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant='overline' color='text.secondary'>
                The Scroll
              </Typography>
              {dayDialog.entries?.length ? (
                <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5 }}>
                  {dayDialog.entries.map((entry) => (
                    <Panel key={entry._id} padding={3}>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1,
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <StatusBadge
                          label={entry.type.replace('-', ' ')}
                          tone={
                            entry.type === 'pre-market'
                              ? 'info'
                              : entry.type === 'post-market'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                        <Typography variant='subtitle2'>
                          {entry.title || 'Journal entry'}
                        </Typography>
                      </Box>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{
                          whiteSpace: 'pre-line',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {entry.content}
                      </Typography>
                    </Panel>
                  ))}
                </Box>
              ) : (
                <EmptyState
                  compact
                  title='No journal entry for this session'
                  description='The calendar only shows records already saved in The Scroll.'
                />
              )}
            </>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              No data for this day.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
