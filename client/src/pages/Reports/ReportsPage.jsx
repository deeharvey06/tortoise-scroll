import { RootOnly } from '@/components/auth/RouteGuards';
import RefreshStatus from '@/components/ui/RefreshStatus';
import ContextAnalytics from '@/pages/Knowledge/ContextAnalytics';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import { useFilterParams } from '@/store/useFilterStore';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ui';

import useReport from '@/pages/Reports/hooks/useReport';
import PerformanceReport from '@/pages/Reports/components/PerformanceReport';
import ExecutionReport from '@/pages/Reports/components/ExecutionReport';
import BehaviorReport from '@/pages/Reports/components/BehaviorReport';
import MarketReport from '@/pages/Reports/components/MarketReport';

const CATEGORIES = ['performance', 'execution', 'behavior', 'market'];

export default function ReportsPage() {
  const params = useFilterParams();
  const [tab, setTab] = useState('performance');
  const { data, loading, refreshing, error } = useReport(tab, params);

  return (
    <Box>
      <RefreshStatus refreshing={refreshing} />
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
        !error &&
        data && (
          <>
            {tab === 'performance' && <PerformanceReport data={data} />}
            {tab === 'execution' && <ExecutionReport data={data} />}
            {tab === 'behavior' && <BehaviorReport data={data} />}
            {tab === 'market' && <MarketReport data={data} />}
          </>
        )
      )}
      <RootOnly>
        <ContextAnalytics filters={params} />
      </RootOnly>
    </Box>
  );
}
