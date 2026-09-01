import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts';

import * as analyticsApi from '../../services/analyticsService';
import { useFilterParams } from '../../store/useFilterStore';
import { palette } from '../../theme/theme';
import PageHeader from '../../components/PageHeader';
import {
  EmptyState, ErrorState, LoadingState, MetricCard, Panel, SectionHeader,
} from '../../components/ui';

function fmtMoney(value) {
  if (value === null || value === undefined) return null;
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function fmtAxisMoney(value) {
  if (!Number.isFinite(Number(value))) return value;
  const number = Number(value);
  const absolute = Math.abs(number);
  const compact = absolute >= 1000000 ? `${(absolute / 1000000).toFixed(1)}m` : absolute >= 1000 ? `${(absolute / 1000).toFixed(1)}k` : absolute.toFixed(0);
  return `${number < 0 ? '−' : ''}$${compact}`;
}

const tooltipStyle = {
  backgroundColor: palette.background.elevated,
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  color: 'var(--ts-text-primary)',
  fontFamily: 'var(--ts-font-numeric)',
  fontSize: 12,
  boxShadow: 'var(--ts-shadow-sm)',
};

const axisStyle = { fontSize: 10, fill: 'var(--ts-chart-axis)' };

function MoneyTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const formattedLabel = labelFormatter ? labelFormatter(label) : label;
  return (
    <Box sx={{ ...tooltipStyle, p: 3 }}>
      {formattedLabel && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{formattedLabel}</Typography>}
      <Typography variant="body2" className="financial-number" sx={{ fontWeight: 700 }}>
        {point.name}: {fmtMoney(point.value)}
      </Typography>
    </Box>
  );
}

function ChartPanel({ title, description, children, empty, height = 260, testId }) {
  return (
    <Panel role="group" aria-label={title} sx={{ height: '100%' }} data-testid={testId}>
      <SectionHeader title={title} description={description} component="h2" />
      {empty ? (
        <EmptyState compact title="No closed trades" description="Adjust the active date range or filters to populate this view." sx={{ height }} />
      ) : (
        <Box sx={{ width: '100%', height }}>{children}</Box>
      )}
    </Panel>
  );
}

function OutcomeBars({ data, dataKey = 'netPnL', categoryKey = 'label', layout, categoryWidth = 64 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={layout} margin={layout === 'vertical' ? { left: 12, right: 12 } : { top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={layout !== 'vertical'} horizontal />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" tick={axisStyle} tickFormatter={fmtAxisMoney} />
            <YAxis type="category" dataKey={categoryKey} tick={axisStyle} width={categoryWidth} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={48} />
          </>
        )}
        <ReferenceLine x={layout === 'vertical' ? 0 : undefined} y={layout === 'vertical' ? undefined : 0} stroke={palette.text.secondary} strokeOpacity={0.55} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: 'var(--ts-surface-hover)' }} />
        <Bar dataKey={dataKey} name="Net P&L" radius={layout === 'vertical' ? [0, 3, 3, 0] : [3, 3, 0, 0]}>
          {data.map((item, index) => <Cell key={`${item.key || item.label || index}`} fill={item[dataKey] >= 0 ? palette.profit : palette.loss} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
      .then((response) => !cancelled && setData(response))
      .catch((requestError) => !cancelled && setError(requestError.response?.data?.error?.message || requestError.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  if (loading) return <LoadingState label="Building your performance view…" skeletonRows={5} />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { summary } = data;
  const hasClosed = summary.closedTrades > 0;
  const evidence = `${summary.closedTrades} closed of ${summary.totalTrades} total trade${summary.totalTrades === 1 ? '' : 's'}`;

  if (summary.totalTrades === 0) {
    return (
      <Box>
        <PageHeader title="Dashboard" eyebrow="Command center" description="A clear view of performance, risk, repeatability, and the evidence behind your trading process." />
        <Panel>
          <EmptyState
            title="No trades match the current view"
            description="Import a broker statement, record a trade, or widen the date range and filters to begin your performance review."
            action={<Button component={RouterLink} to="/trades" variant="contained">Open trades</Button>}
          />
        </Panel>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        eyebrow="Command center"
        description="Performance, risk, repeatability, and the evidence behind your current results."
      />

      <Box component="section" aria-label="Performance overview" sx={{ mb: 8 }}>
        <SectionHeader title="Performance overview" description={evidence} component="h2" sx={{ mb: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' }, gap: 3 }}>
          <Box sx={{ gridColumn: { sm: 'span 2', lg: 'span 2' } }}>
            <MetricCard label="Net P&L" value={fmtMoney(summary.netPnL)} colorByValue emphasis="primary" supportingText={evidence} />
          </Box>
          <Box>
            <MetricCard label="Win rate" value={summary.winRate} suffix="%" emphasis="primary" supportingText={`${summary.winningTrades} winners`} />
          </Box>
          <Box>
            <MetricCard label="Profit factor" value={summary.profitFactor} emphasis="primary" supportingText="Gross profit ÷ gross loss" />
          </Box>
          <Box>
            <MetricCard label="Expectancy" value={fmtMoney(summary.expectancy)} colorByValue emphasis="primary" supportingText="Average per closed trade" />
          </Box>
          <Box>
            <MetricCard label="Avg R" value={summary.avgR === null ? null : summary.avgR.toFixed(2)} suffix="R" colorByValue emphasis="primary" supportingText="Risk-normalized outcome" />
          </Box>
          <Box>
            <MetricCard label="Max drawdown" value={fmtMoney(summary.maxDrawdown)} colorByValue emphasis="primary" supportingText="Largest peak-to-trough decline" />
          </Box>
        </Box>
      </Box>

      <Box component="section" aria-label="Equity and drawdown" sx={{ mb: 8 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} lg={8}>
            <ChartPanel title="Equity curve" description={`Cumulative closed-trade P&L · ${summary.closedTrades} trade sample`} empty={!hasClosed} height={360} testId="chart-equity-curve">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.equityCurve} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
                  <XAxis dataKey="date" tick={axisStyle} tickFormatter={(date) => new Date(date).toLocaleDateString()} minTickGap={28} />
                  <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={56} />
                  <ReferenceLine y={0} stroke={palette.text.secondary} strokeOpacity={0.55} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(date) => new Date(date).toLocaleString()} />} />
                  <Line type="monotone" dataKey="equity" name="Equity" stroke={palette.accent.main} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={4}>
            <ChartPanel title="Drawdown" description="Distance below the running equity peak" empty={!hasClosed} height={360} testId="chart-drawdown">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.drawdownCurve} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
                  <XAxis dataKey="date" tick={axisStyle} tickFormatter={(date) => new Date(date).toLocaleDateString()} minTickGap={36} />
                  <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={52} />
                  <ReferenceLine y={0} stroke={palette.text.secondary} strokeOpacity={0.55} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(date) => new Date(date).toLocaleString()} />} />
                  <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke={palette.loss} fill={palette.loss} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartPanel>
          </Grid>
        </Grid>
      </Box>

      <Box component="section" aria-label="Sample and outcome evidence" sx={{ mb: 8 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} lg={8}>
            <Panel>
              <SectionHeader title="Outcome evidence" description="Supporting metrics behind the headline result" component="h2" />
              <Grid container spacing={3}>
                <Grid item xs={6} sm={4}><MetricCard label="Gross P&L" value={fmtMoney(summary.grossPnL)} colorByValue /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Avg winner" value={fmtMoney(summary.avgWin)} colorByValue /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Avg loser" value={fmtMoney(summary.avgLoss)} colorByValue /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Largest winner" value={fmtMoney(summary.largestWinner)} colorByValue /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Largest loser" value={fmtMoney(summary.largestLoser)} colorByValue /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Avg holding time" value={fmtDuration(summary.avgHoldingTimeSeconds)} /></Grid>
              </Grid>
            </Panel>
          </Grid>
          <Grid item xs={12} lg={4}>
            <Panel sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <SectionHeader title="Process review" description="Review behavior and rule adherence alongside profitability." component="h2" />
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={6} sm={4}><MetricCard label="Total trades" value={summary.totalTrades} /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Closed trades" value={summary.closedTrades} /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Open trades" value={summary.openTrades} /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Winning trades" value={summary.winningTrades} /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Losing trades" value={summary.losingTrades} /></Grid>
                <Grid item xs={6} sm={4}><MetricCard label="Loss rate" value={summary.lossRate} suffix="%" /></Grid>
              </Grid>
              <Button component={RouterLink} to="/reports" endIcon={<ArrowForwardIcon />} sx={{ mt: 'auto', alignSelf: 'flex-start' }}>
                Review process evidence
              </Button>
            </Panel>
          </Grid>
        </Grid>
      </Box>

      <Box component="section" aria-label="Consistency and distribution" sx={{ mb: 8 }}>
        <SectionHeader title="Consistency and distribution" description="How results are distributed across individual trades and trading days." component="h2" />
        <Grid container spacing={4}>
          <Grid item xs={12} lg={6}>
            <ChartPanel title="Daily P&L" description={`${data.dailyStats.length} trading day${data.dailyStats.length === 1 ? '' : 's'} in this view`} empty={!hasClosed} testId="chart-daily-p-l">
              <OutcomeBars data={data.dailyStats} categoryKey="date" />
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={3}>
            <ChartPanel title="Win / loss distribution" description={`${summary.closedTrades} closed trades`} empty={!hasClosed} testId="chart-win-loss-distribution">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.winLossDistribution} margin={{ left: 0, right: 8, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} interval={0} angle={-24} textAnchor="end" height={54} />
                  <YAxis tick={axisStyle} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--ts-surface-hover)' }} />
                  <Bar dataKey="count" name="Trades" fill={palette.accent.main} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={3}>
            <ChartPanel title="R-multiple distribution" description="Risk-normalized trade outcomes" empty={!hasClosed} testId="chart-r-multiple-distribution">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rMultipleDistribution} margin={{ left: 0, right: 8, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} interval={0} angle={-24} textAnchor="end" height={54} />
                  <YAxis tick={axisStyle} allowDecimals={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--ts-surface-hover)' }} />
                  <Bar dataKey="count" name="Trades" fill={palette.neutralAmber} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </Grid>
        </Grid>
      </Box>

      <Box component="section" aria-label="What is working" sx={{ mb: 8 }}>
        <SectionHeader title="What is working—and what is not" description="Net results grouped by setup and symbol, with each category based only on existing closed trades." component="h2" />
        <Grid container spacing={4}>
          <Grid item xs={12} lg={6}>
            <ChartPanel title="P&L by setup" description={`${data.bySetup.length} setup${data.bySetup.length === 1 ? '' : 's'} represented`} empty={!hasClosed} testId="chart-p-l-by-setup">
              <OutcomeBars data={data.bySetup} layout="vertical" categoryWidth={88} />
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={6}>
            <ChartPanel title="P&L by symbol" description={`${data.bySymbol.length} symbol${data.bySymbol.length === 1 ? '' : 's'} represented`} empty={!hasClosed} testId="chart-p-l-by-symbol">
              <OutcomeBars data={data.bySymbol} layout="vertical" categoryWidth={70} />
            </ChartPanel>
          </Grid>
        </Grid>
      </Box>

      <Box component="section" aria-label="Timing evidence">
        <SectionHeader title="Timing evidence" description="Where results concentrate across weekdays and entry hours." component="h2" />
        <Grid container spacing={4}>
          <Grid item xs={12} lg={6}>
            <ChartPanel title="P&L by day of week" empty={!hasClosed} testId="chart-p-l-by-day-of-week">
              <OutcomeBars data={data.byDayOfWeek} />
            </ChartPanel>
          </Grid>
          <Grid item xs={12} lg={6}>
            <ChartPanel title="P&L by entry hour" description="Hours are reported in UTC by the existing analytics source." empty={!hasClosed} testId="chart-p-l-by-hour-entry-time-utc">
              <OutcomeBars data={data.byHour} />
            </ChartPanel>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
