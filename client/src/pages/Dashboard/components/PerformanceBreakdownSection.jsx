import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { SectionHeader } from '@/components/ui';

import ChartPanel from '@/components/charts/ChartPanel';
import OutcomeBars from '@/components/charts/OutcomeBars';

export default function PerformanceBreakdownSection({ data, hasClosed }) {
  return (
    <Box component='section' aria-label='What is working' sx={{ mb: 8 }}>
      <SectionHeader
        title='What is working—and what is not'
        description='Net results grouped by setup and symbol, with each category based only on existing closed trades.'
        component='h2'
      />
      <Grid container spacing={4}>
        <Grid item xs={12} lg={6}>
          <ChartPanel
            title='P&L by setup'
            description={`${data.bySetup.length} setup${data.bySetup.length === 1 ? '' : 's'} represented`}
            empty={!hasClosed}
            testId='chart-p-l-by-setup'
          >
            <OutcomeBars
              data={data.bySetup}
              layout='vertical'
              categoryWidth={88}
            />
          </ChartPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <ChartPanel
            title='P&L by symbol'
            description={`${data.bySymbol.length} symbol${data.bySymbol.length === 1 ? '' : 's'} represented`}
            empty={!hasClosed}
            testId='chart-p-l-by-symbol'
          >
            <OutcomeBars
              data={data.bySymbol}
              layout='vertical'
              categoryWidth={70}
            />
          </ChartPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
