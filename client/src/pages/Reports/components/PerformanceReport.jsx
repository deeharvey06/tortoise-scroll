import Grid from '@mui/material/Grid';

import KpiCard from '@/components/KpiCard';

import { fmtMoney } from '@/pages/Reports/formatters';
export default function PerformanceReport({ data = {} }) {
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
