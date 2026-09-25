import Grid from '@mui/material/Grid';

import { ComparisonBarChart } from '@/components/charts';
import { EmptyState, Panel, SectionHeader } from '@/components/ui';

import GroupTable from '@/pages/Reports/components/GroupTable';
export default function MarketReport({ data }) {
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
