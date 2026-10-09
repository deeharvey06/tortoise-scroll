import Box from '@mui/material/Box';

import { EmptyState, Panel, SectionHeader } from '@/components/ui';

export default function ChartPanel({
  title,
  description,
  children,
  empty,
  height = 260,
  testId,
}) {
  return (
    <Panel
      role='group'
      aria-label={title}
      sx={{ height: '100%' }}
      data-testid={testId}
    >
      <SectionHeader title={title} description={description} component='h2' />
      {empty ? (
        <EmptyState
          compact
          title='No closed trades'
          description='Adjust the active date range or filters to populate this view.'
          sx={{ height }}
        />
      ) : (
        <Box sx={{ width: '100%', height }}>{children}</Box>
      )}
    </Panel>
  );
}
