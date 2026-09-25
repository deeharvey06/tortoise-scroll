import RefreshStatus from '@/components/ui/RefreshStatus';
import TimingSection from '@/pages/Dashboard/components/TimingSection';
import PerformanceBreakdownSection from '@/pages/Dashboard/components/PerformanceBreakdownSection';
import DistributionSection from '@/pages/Dashboard/components/DistributionSection';
import OutcomeEvidenceSection from '@/pages/Dashboard/components/OutcomeEvidenceSection';
import EquitySection from '@/pages/Dashboard/components/EquitySection';
import useDashboard from '@/hooks/useDashboard';
import { routes } from '@/config/routes';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { useFilterParams } from '@/store/useFilterStore';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  Panel,
  SectionHeader,
} from '@/components/ui';

import { fmtMoney } from '@/utils/financialFormatting';
export default function DashboardPage() {
  const params = useFilterParams();
  const { data, loading, refreshing, error } = useDashboard(params);

  if (loading)
    return (
      <LoadingState label='Building your performance view…' skeletonRows={5} />
    );
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { summary } = data;
  const hasClosed = summary.closedTrades > 0;
  const evidence = `${summary.closedTrades} closed of ${summary.totalTrades} total trade${summary.totalTrades === 1 ? '' : 's'}`;

  if (summary.totalTrades === 0) {
    return (
      <Box>
        <RefreshStatus refreshing={refreshing} />
        <PageHeader
          title='Dashboard'
          eyebrow='Command center'
          description='A clear view of performance, risk, repeatability, and the evidence behind your trading process.'
        />
        <Panel>
          <EmptyState
            title='No trades match the current view'
            description='Import a broker statement, record a trade, or widen the date range and filters to begin your performance review.'
            action={
              <Button
                component={RouterLink}
                to={routes.trades}
                variant='contained'
              >
                Open trades
              </Button>
            }
          />
        </Panel>
      </Box>
    );
  }

  return (
    <Box>
      <RefreshStatus refreshing={refreshing} />
      <PageHeader
        title='Dashboard'
        eyebrow='Command center'
        description='Performance, risk, repeatability, and the evidence behind your current results.'
      />

      <Box component='section' aria-label='Performance overview' sx={{ mb: 8 }}>
        <SectionHeader
          title='Performance overview'
          description={evidence}
          component='h2'
          sx={{ mb: 3 }}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(7, minmax(0, 1fr))',
            },
            gap: 3,
          }}
        >
          <Box sx={{ gridColumn: { sm: 'span 2', lg: 'span 2' } }}>
            <MetricCard
              label='Net P&L'
              value={fmtMoney(summary.netPnL)}
              colorByValue
              emphasis='primary'
              supportingText={evidence}
            />
          </Box>
          <Box>
            <MetricCard
              label='Win rate'
              value={summary.winRate}
              suffix='%'
              emphasis='primary'
              supportingText={`${summary.winningTrades} winners`}
            />
          </Box>
          <Box>
            <MetricCard
              label='Profit factor'
              value={summary.profitFactor}
              emphasis='primary'
              supportingText='Gross profit ÷ gross loss'
            />
          </Box>
          <Box>
            <MetricCard
              label='Expectancy'
              value={fmtMoney(summary.expectancy)}
              colorByValue
              emphasis='primary'
              supportingText='Average per closed trade'
            />
          </Box>
          <Box>
            <MetricCard
              label='Avg R'
              value={summary.avgR === null ? null : summary.avgR.toFixed(2)}
              suffix='R'
              colorByValue
              emphasis='primary'
              supportingText='Risk-normalized outcome'
            />
          </Box>
          <Box>
            <MetricCard
              label='Max drawdown'
              value={fmtMoney(summary.maxDrawdown)}
              colorByValue
              emphasis='primary'
              supportingText='Largest peak-to-trough decline'
            />
          </Box>
        </Box>
      </Box>

      <EquitySection data={data} summary={summary} hasClosed={hasClosed} />

      <OutcomeEvidenceSection summary={summary} />

      <DistributionSection
        data={data}
        summary={summary}
        hasClosed={hasClosed}
      />

      <PerformanceBreakdownSection data={data} hasClosed={hasClosed} />

      <TimingSection data={data} hasClosed={hasClosed} />
    </Box>
  );
}
