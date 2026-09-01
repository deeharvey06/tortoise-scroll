import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import * as reportsApi from '../../services/reportsService';
import * as strategyApi from '../../services/strategyService';
import { useFilterParams } from '../../store/useFilterStore';
import KpiCard from '../../components/KpiCard';
import PageHeader from '../../components/PageHeader';
import { ComparisonBarChart } from '../../components/charts';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  ProfitLossValue,
  SectionHeader,
  Tag,
} from '../../components/ui';

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
      <Typography variant='body2' color='text.secondary'>
        No closed trades in this range.
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size='small' aria-label={`${keyLabel} comparison`}>
        <TableHead>
          <TableRow>
            <TableCell>{keyLabel}</TableCell>
            <TableCell align='right'>Trades</TableCell>
            <TableCell align='right'>Win rate</TableCell>
            <TableCell align='right'>Net P&L</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key} hover>
              <TableCell>{r.label}</TableCell>
              <TableCell align='right' className='mono-data'>
                {r.count}
              </TableCell>
              <TableCell align='right' className='mono-data'>
                {r.winRate !== null ? `${r.winRate}%` : '—'}
              </TableCell>
              <TableCell align='right'>
                <ProfitLossValue value={r.netPnL} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function PerformanceReport({ data = {} }) {
  const summary = data.summary ?? {};

  return (
    <Grid container spacing={1.5}>
      <Grid item xs={6} sm={3}>
        <KpiCard
          label='Net P&L'
          value={fmtMoney(summary.netPnL ?? null)}
          colorByValue
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label='Win rate' value={summary.winRate ?? null} suffix='%' />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard
          label='Expectancy'
          value={fmtMoney(summary.expectancy ?? null)}
          colorByValue
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label='Profit factor' value={summary.profitFactor ?? null} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label='Avg R' value={summary.avgR ?? null} suffix='R' />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard
          label='Max drawdown'
          value={fmtMoney(summary.maxDrawdown ?? null)}
          colorByValue
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label='Closed trades' value={summary.closedTrades ?? 0} />
      </Grid>
      <Grid item xs={6} sm={3}>
        <KpiCard label='Open trades' value={summary.openTrades ?? 0} />
      </Grid>
    </Grid>
  );
}

function ExecutionReport({ data = {} }) {
  const holdingTimeStats = data.holdingTimeStats ?? {};
  const byHour = data.byHour ?? [];

  return (
    <Box>
      <Alert severity='info' sx={{ mb: 2 }}>
        {data.note}
      </Alert>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard label='Sample size' value={data.sampleSize} />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Avg holding time'
            value={fmtDuration(holdingTimeStats.avgSeconds)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Shortest hold'
            value={fmtDuration(holdingTimeStats.minSeconds)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Longest hold'
            value={fmtDuration(holdingTimeStats.maxSeconds)}
          />
        </Grid>
      </Grid>
      <Panel>
        <SectionHeader
          title='Entry timing (by hour, UTC)'
          description='Compare outcomes and sample sizes across entry windows.'
        />
        <ComparisonBarChart rows={byHour} />
        <GroupTable rows={byHour} keyLabel='Hour' />
      </Panel>
    </Box>
  );
}

function BehaviorReport({ data = {} }) {
  const streaks = data.streaks ?? {};
  const ruleViolations = data.ruleViolations ?? {};
  const mistakes = data.mistakes ?? [];
  const emotions = data.emotions ?? [];

  return (
    <Box>
      <Alert severity='info' sx={{ mb: 2 }}>
        {data.note}
      </Alert>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Longest loss streak'
            value={streaks.longestLossStreak ?? 0}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Avg R after 2+ losses'
            value={streaks.avgRAfterTwoConsecutiveLosses ?? null}
            suffix={
              streaks.avgRAfterTwoConsecutiveLosses !== null &&
              streaks.avgRAfterTwoConsecutiveLosses !== undefined
                ? 'R'
                : ''
            }
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Plan violations'
            value={ruleViolations.violations ?? 0}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Violation rate'
            value={ruleViolations.violationRate ?? null}
            suffix={
              ruleViolations.violationRate !== null &&
              ruleViolations.violationRate !== undefined
                ? '%'
                : ''
            }
          />
        </Grid>
      </Grid>
      {(streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0) > 0 &&
        (streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0) < 10 && (
          <Alert severity='warning' sx={{ mb: 2 }}>
            Only {streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0} trade(s)
            followed two consecutive losses in this range — too few to draw a
            conclusion from.
          </Alert>
        )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              title='Mistakes tagged on trades'
              description='Frequency, sample size, and associated average outcome.'
            />
            {mistakes.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No trades tagged with a mistake in this range.
              </Typography>
            ) : (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Mistake</TableCell>
                    <TableCell align='right'>Count</TableCell>
                    <TableCell align='right'>Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mistakes.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Tag label={m.tag} />
                      </TableCell>
                      <TableCell align='right' className='mono-data'>
                        {m.count}
                      </TableCell>
                      <TableCell align='right'>
                        <ProfitLossValue value={m.avgPnL} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              title='Emotions tagged on trades'
              description='Frequency, sample size, and associated average outcome.'
            />
            {emotions.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No trades tagged with an emotion in this range.
              </Typography>
            ) : (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Emotion</TableCell>
                    <TableCell align='right'>Count</TableCell>
                    <TableCell align='right'>Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emotions.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Tag label={m.tag} />
                      </TableCell>
                      <TableCell align='right' className='mono-data'>
                        {m.count}
                      </TableCell>
                      <TableCell align='right'>
                        <ProfitLossValue value={m.avgPnL} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}

function MarketReport({ data }) {
  const comparisons = [
    ['By symbol', data.bySymbol, 'Symbol'],
    ['By session', data.bySession, 'Session'],
    ['Long vs short', data.byDirection, 'Direction'],
    ['By strategy', data.byStrategy, 'Strategy'],
    ['By setup', data.bySetup, 'Setup'],
    ['By day of week', data.byDayOfWeek, 'Day'],
    ['By hour (entry, UTC)', data.byHour, 'Hour'],
  ];
  return (
    <Grid container spacing={2}>
      {comparisons.map(([title, rows, label]) => (
        <Grid item xs={12} xl={6} key={title}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              title={title}
              description={`${rows?.reduce((sum, row) => sum + row.count, 0) || 0} trades represented`}
            />
            {rows?.length ? (
              <>
                <ComparisonBarChart rows={rows} />
                <GroupTable rows={rows} keyLabel={label} />
              </>
            ) : (
              <EmptyState
                compact
                title='No comparison available'
                description='Adjust the active range or filters.'
              />
            )}
          </Panel>
        </Grid>
      ))}
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
    const request =
      tab === 'market'
        ? Promise.all([
            reportsApi.fetchReport(tab, params),
            strategyApi.fetchStrategies(),
          ]).then(([report, strategies]) => ({
            ...report,
            byStrategy: report.byStrategy.map((row) => ({
              ...row,
              label:
                strategies.find((strategy) => strategy._id === String(row.key))
                  ?.name || 'Unresolved strategy',
            })),
          }))
        : reportsApi.fetchReport(tab, params);
    request
      .then((d) => !cancelled && setData(d))
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
  }, [tab, JSON.stringify(params)]);

  return (
    <Box>
      <PageHeader
        eyebrow='Comparative review'
        title='Reports'
        description='Compare outcomes across execution, behavior, market context, and process—with sample size always visible.'
      />

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        {CATEGORIES.map((c) => (
          <Tab
            key={c}
            value={c}
            label={c.charAt(0).toUpperCase() + c.slice(1)}
          />
        ))}
      </Tabs>

      {error && <ErrorState compact message={error} sx={{ mb: 4 }} />}

      {loading ? (
        <LoadingState label='Building report…' skeletonRows={5} />
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
