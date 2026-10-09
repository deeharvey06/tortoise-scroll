import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';

import KpiCard from '@/components/KpiCard';
import { ComparisonBarChart } from '@/components/charts';
import { Panel, SectionHeader } from '@/components/ui';

import { fmtDuration } from '@/pages/Reports/formatters';
import GroupTable from '@/pages/Reports/components/GroupTable';
export default function ExecutionReport({ data = {} }) {
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
