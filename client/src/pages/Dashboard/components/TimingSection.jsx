import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { SectionHeader } from '@/components/ui';

import ChartPanel from '@/components/charts/ChartPanel';
import OutcomeBars from '@/components/charts/OutcomeBars';

export default function TimingSection({ data, hasClosed }) {
  return (
    <Box component='section' aria-label='Timing evidence'>
      <SectionHeader
        title='Timing evidence'
        description='Where results concentrate across weekdays and entry hours.'
        component='h2'
      />
      <Grid container spacing={4}>
        <Grid item xs={12} lg={6}>
          <ChartPanel
            title='P&L by day of week'
            empty={!hasClosed}
            testId='chart-p-l-by-day-of-week'
          >
            <OutcomeBars data={data.byDayOfWeek} />
          </ChartPanel>
        </Grid>
        <Grid item xs={12} lg={6}>
          <ChartPanel
            title='P&L by entry hour'
            description='Hours are reported in UTC by the existing analytics source.'
            empty={!hasClosed}
            testId='chart-p-l-by-hour-entry-time-utc'
          >
            <OutcomeBars data={data.byHour} />
          </ChartPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
