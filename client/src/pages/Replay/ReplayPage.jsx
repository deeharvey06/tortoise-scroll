import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import TradeReviewPage from '@/pages/Replay/TradeReviewPage';
import ReplayWorkspace from '@/pages/Replay/ReplayWorkspace';

export default function ReplayPage() {
  const [tab, setTab] = useState('market');
  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        aria-label='Replay workspace'
        sx={{ mb: 3 }}
      >
        <Tab value='market' label='Market replay' />
        <Tab value='trades' label='Trade review' />
      </Tabs>
      {tab === 'market' ? <ReplayWorkspace /> : <TradeReviewPage />}
    </Box>
  );
}
