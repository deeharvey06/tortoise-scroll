import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { SectionHeader } from '@/components/ui';

import ChartPanel from '@/components/charts/ChartPanel';
import OutcomeBars from '@/components/charts/OutcomeBars';
import WinLossDistributionChart from '@/components/charts/WinLossDistributionChart';
import RMultipleDistributionChart from '@/components/charts/RMultipleDistributionChart';

export default function DistributionSection({ data, summary, hasClosed }) {
  return (
    <Box
      component='section'
      aria-label='Consistency and distribution'
      sx={{ mb: 8 }}
    >
      <SectionHeader
        title='Consistency and distribution'
        description='How results are distributed across individual trades and trading days.'
        component='h2'
      />
      <Grid container spacing={4}>
        <Grid item xs={12} lg={6}>
          <ChartPanel
            title='Daily P&L'
            description={`${data.dailyStats.length} trading day${data.dailyStats.length === 1 ? '' : 's'} in this view`}
            empty={!hasClosed}
            testId='chart-daily-p-l'
          >
            <OutcomeBars data={data.dailyStats} categoryKey='date' />
          </ChartPanel>
        </Grid>
        <Grid item xs={12} lg={3}>
          <ChartPanel
            title='Win / loss distribution'
            description={`${summary.closedTrades} closed trades`}
            empty={!hasClosed}
            testId='chart-win-loss-distribution'
          >
            <WinLossDistributionChart data={data.winLossDistribution} />
          </ChartPanel>
        </Grid>
        <Grid item xs={12} lg={3}>
          <ChartPanel
            title='R-multiple distribution'
            description='Risk-normalized trade outcomes'
            empty={!hasClosed}
            testId='chart-r-multiple-distribution'
          >
            <RMultipleDistributionChart data={data.rMultipleDistribution} />
          </ChartPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
