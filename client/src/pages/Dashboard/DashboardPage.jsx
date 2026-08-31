import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

import * as analyticsApi from '../../services/analyticsService';
import { useFilterParams } from '../../store/useFilterStore';
import { palette } from '../../theme/theme';
import KpiCard from '../../components/KpiCard';

function fmtMoney(v) {
  if (v === null || v === undefined) return null;
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const chartTooltipStyle = {
  backgroundColor: palette.background.elevated,
  border: `1px solid ${palette.border}`,
  borderRadius: 4,
  fontSize: 12,
};

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function ChartSection({ title, children, empty }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }} data-testid={`chart-${slugify(title)}`}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {empty ? (
        <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No closed trades in this range.
          </Typography>
        </Box>
      ) : (
        children
      )}
    </Paper>
  );
}

export default function DashboardPage() {
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

  const { summary } = data;
  const hasClosed = summary.closedTrades > 0;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      {summary.totalTrades === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No trades match the current filters. Log trades or import a CSV, or widen the date range / filters above.
        </Alert>
      )}

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Net P&L" value={fmtMoney(summary.netPnL)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Gross P&L" value={fmtMoney(summary.grossPnL)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Win rate" value={summary.winRate} suffix="%" />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Loss rate" value={summary.lossRate} suffix="%" />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Profit factor" value={summary.profitFactor} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Expectancy" value={fmtMoney(summary.expectancy)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Avg win" value={fmtMoney(summary.avgWin)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Avg loss" value={fmtMoney(summary.avgLoss)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Avg R" value={summary.avgR} suffix="R" />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Total trades" value={summary.totalTrades} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Winning trades" value={summary.winningTrades} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Losing trades" value={summary.losingTrades} />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Largest winner" value={fmtMoney(summary.largestWinner)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Largest loser" value={fmtMoney(summary.largestLoser)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Max drawdown" value={fmtMoney(summary.maxDrawdown)} colorByValue />
        </Grid>
        <Grid item xs={6} sm={3} md={2}>
          <KpiCard label="Avg holding time" value={fmtDuration(summary.avgHoldingTimeSeconds)} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ChartSection title="Equity curve" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(d) => new Date(d).toLocaleString()} />
                <Line type="monotone" dataKey="equity" stroke={palette.accent.main} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="Drawdown" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.drawdownCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(d) => new Date(d).toLocaleString()} />
                <Area type="monotone" dataKey="drawdown" stroke={palette.loss} fill={palette.loss} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="Daily P&L" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPnL">
                  {data.dailyStats.map((d, i) => (
                    <Cell key={i} fill={d.netPnL >= 0 ? palette.profit : palette.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="Win / loss distribution" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.winLossDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill={palette.accent.main} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="R-multiple distribution" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.rMultipleDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill={palette.neutralAmber} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="P&L by day of week" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPnL">
                  {data.byDayOfWeek.map((d, i) => (
                    <Cell key={i} fill={d.netPnL >= 0 ? palette.profit : palette.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="P&L by hour (entry time, UTC)" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPnL">
                  {data.byHour.map((d, i) => (
                    <Cell key={i} fill={d.netPnL >= 0 ? palette.profit : palette.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="P&L by symbol" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.bySymbol} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={60} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPnL">
                  {data.bySymbol.map((d, i) => (
                    <Cell key={i} fill={d.netPnL >= 0 ? palette.profit : palette.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartSection title="P&L by setup" empty={!hasClosed}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.bySetup} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="netPnL">
                  {data.bySetup.map((d, i) => (
                    <Cell key={i} fill={d.netPnL >= 0 ? palette.profit : palette.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        </Grid>
      </Grid>
    </Box>
  );
}
