import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import * as reportsApi from '../../services/reportsService';
import { useFilterParams } from '../../store/useFilterStore';
import KpiCard from '../../components/KpiCard';

const CATEGORIES = ['performance', 'execution', 'behavior', 'market'];

function fmtMoney(v) {
  if (v === null || v === undefined) return null;
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function GroupTable({ rows, keyLabel }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No closed trades in this range.
      </Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{keyLabel}</TableCell>
          <TableCell align="right">Trades</TableCell>
          <TableCell align="right">Win rate</TableCell>
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
            <TableCell align="right" className="mono-data" sx={{ color: r.netPnL >= 0 ? 'success.main' : 'error.main' }}>
              {fmtMoney(r.netPnL)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PerformanceReport({ data }) {
  const { summary } = data;
  return (
    <Grid container spacing={1.5}>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Net P&L" value={fmtMoney(summary.netPnL)} colorByValue />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Win rate" value={summary.winRate} suffix="%" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Expectancy" value={fmtMoney(summary.expectancy)} colorByValue />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Profit factor" value={summary.profitFactor} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Avg R" value={summary.avgR} suffix="R" />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Max drawdown" value={fmtMoney(summary.maxDrawdown)} colorByValue />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Closed trades" value={summary.closedTrades} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label="Open trades" value={summary.openTrades} />
      </Grid>
    </Grid>
  );
}

function ExecutionReport({ data }) {
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {data.note}
      </Alert>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Sample size" value={data.sampleSize} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Avg holding time" value={fmtDuration(data.holdingTimeStats.avgSeconds)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Shortest hold" value={fmtDuration(data.holdingTimeStats.minSeconds)} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Longest hold" value={fmtDuration(data.holdingTimeStats.maxSeconds)} />
        </Grid>
      </Grid>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          Entry timing (by hour, UTC)
        </Typography>
        <GroupTable rows={data.byHour} keyLabel="Hour" />
      </Paper>
    </Box>
  );
}

function BehaviorReport({ data }) {
  const { streaks, ruleViolations } = data;
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {data.note}
      </Alert>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Longest loss streak" value={streaks.longestLossStreak} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Avg R after 2+ losses"
            value={streaks.avgRAfterTwoConsecutiveLosses}
            suffix={streaks.avgRAfterTwoConsecutiveLosses !== null ? 'R' : ''}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard label="Plan violations" value={ruleViolations.violations} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label="Violation rate"
            value={ruleViolations.violationRate}
            suffix={ruleViolations.violationRate !== null ? '%' : ''}
          />
        </Grid>
      </Grid>
      {streaks.sampleSizeAfterTwoConsecutiveLosses > 0 && streaks.sampleSizeAfterTwoConsecutiveLosses < 10 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Only {streaks.sampleSizeAfterTwoConsecutiveLosses} trade(s) followed two consecutive losses in this range —
          too few to draw a conclusion from.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Mistakes tagged on trades
            </Typography>
            {data.mistakes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No trades tagged with a mistake in this range.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Mistake</TableCell>
                    <TableCell align="right">Count</TableCell>
                    <TableCell align="right">Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.mistakes.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Chip size="small" label={m.tag} />
                      </TableCell>
                      <TableCell align="right" className="mono-data">
                        {m.count}
                      </TableCell>
                      <TableCell align="right" className="mono-data" sx={{ color: m.avgPnL >= 0 ? 'success.main' : 'error.main' }}>
                        {fmtMoney(m.avgPnL)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Emotions tagged on trades
            </Typography>
            {data.emotions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No trades tagged with an emotion in this range.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Emotion</TableCell>
                    <TableCell align="right">Count</TableCell>
                    <TableCell align="right">Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.emotions.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Chip size="small" label={m.tag} />
                      </TableCell>
                      <TableCell align="right" className="mono-data">
                        {m.count}
                      </TableCell>
                      <TableCell align="right" className="mono-data" sx={{ color: m.avgPnL >= 0 ? 'success.main' : 'error.main' }}>
                        {fmtMoney(m.avgPnL)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function MarketReport({ data }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            By symbol
          </Typography>
          <GroupTable rows={data.bySymbol} keyLabel="Symbol" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            By session
          </Typography>
          <GroupTable rows={data.bySession} keyLabel="Session" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Long vs short
          </Typography>
          <GroupTable rows={data.byDirection} keyLabel="Direction" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            By day of week
          </Typography>
          <GroupTable rows={data.byDayOfWeek} keyLabel="Day" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            By setup
          </Typography>
          <GroupTable rows={data.bySetup} keyLabel="Setup" />
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2, height: '100%' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            By hour (entry, UTC)
          </Typography>
          <GroupTable rows={data.byHour} keyLabel="Hour" />
        </Paper>
      </Grid>
    </Grid>
  );
}

export default function ReportsPage() {
  const params = useFilterParams();
  const [tab, setTab] = useState('performance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    reportsApi
      .fetchReport(tab, params)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, JSON.stringify(params)]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Reports
      </Typography>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        {CATEGORIES.map((c) => (
          <Tab key={c} value={c} label={c.charAt(0).toUpperCase() + c.slice(1)} />
        ))}
      </Tabs>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        data && (
          <>
            {tab === 'performance' && <PerformanceReport data={data} />}
            {tab === 'execution' && <ExecutionReport data={data} />}
            {tab === 'behavior' && <BehaviorReport data={data} />}
            {tab === 'market' && <MarketReport data={data} />}
          </>
        )
      )}
    </Box>
  );
}
