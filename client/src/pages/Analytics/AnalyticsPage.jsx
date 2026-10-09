import { RootOnly } from '@/components/auth/RouteGuards';
import RefreshStatus from '@/components/ui/RefreshStatus';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import { useFilterParams } from '@/store/useFilterStore';
import { ErrorState, LoadingState } from '@/components/ui';

import ContextAnalytics from '@/pages/Knowledge/ContextAnalytics';

import PageHeader from '@/components/PageHeader';

import BreakdownTable from '@/pages/Analytics/components/BreakdownTable';
import useAnalytics from '@/hooks/useAnalytics';

export default function AnalyticsPage() {
  const params = useFilterParams();
  const { data, loading, refreshing, error } = useAnalytics(params);

  if (loading) return <LoadingState label='Loading analytics…' />;

  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <Box>
      <RefreshStatus refreshing={refreshing} />
      <PageHeader
        eyebrow='Pattern analysis'
        title='Analytics'
        description='Every comparison is built from your closed trades. Sample size stays visible so weak signals are never presented as strong evidence.'
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by symbol' rows={data.bySymbol} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by setup' rows={data.bySetup} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by strategy' rows={data.byStrategy} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by session' rows={data.bySession} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by direction' rows={data.byDirection} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by day of week' rows={data.byDayOfWeek} />
        </Grid>
        <Grid item xs={12} md={6}>
          <BreakdownTable title='P&L by hour (entry, UTC)' rows={data.byHour} />
        </Grid>
      </Grid>
      <RootOnly>
        <ContextAnalytics filters={params} />
      </RootOnly>
    </Box>
  );
}
