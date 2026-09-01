import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import * as analyticsApi from '../../services/analyticsService';
import * as strategyApi from '../../services/strategyService';
import { useFilterParams } from '../../store/useFilterStore';
import { EmptyState, ErrorState, LoadingState, Panel, ProfitLossValue, RMultiple, SectionHeader } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { ComparisonBarChart } from '../../components/charts';

function BreakdownTable({ title, rows }) {
  return (
    <Panel sx={{ height: '100%' }}>
      <SectionHeader title={title} component="h2" />
      {rows.length === 0 ? (
        <EmptyState compact title="No closed trades" description="Adjust the selected range or filters to expand this analysis." />
      ) : (
        <>
        <ComparisonBarChart rows={rows} />
        <Box sx={{ overflowX: 'auto', mt: 2 }}><Table size="small">
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
                  <RMultiple value={r.avgR} colorByValue={false} />
                </TableCell>
                <TableCell align="right" className="mono-data">
                  {r.profitFactor !== null ? r.profitFactor.toFixed(2) : '—'}
                </TableCell>
                <TableCell align="right">
                  <ProfitLossValue value={r.netPnL} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></Box>
        </>
      )}
    </Panel>
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
    Promise.all([analyticsApi.fetchDashboard(params), strategyApi.fetchStrategies()])
      .then(([dashboard, strategies]) => !cancelled && setData({
        ...dashboard,
        byStrategy: dashboard.byStrategy.map((row) => ({ ...row, label: strategies.find((strategy) => strategy._id === String(row.key))?.name || 'Unresolved strategy' })),
      }))
      .catch((err) => !cancelled && setError(err.response?.data?.error?.message || err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  if (loading) return <LoadingState label="Loading analytics…" />;

  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <Box>
      <PageHeader eyebrow='Pattern analysis' title='Analytics' description='Every comparison is built from your closed trades. Sample size stays visible so weak signals are never presented as strong evidence.' />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by symbol" rows={data.bySymbol} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by setup" rows={data.bySetup} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title="P&L by strategy" rows={data.byStrategy} />
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
