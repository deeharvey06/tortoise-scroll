import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { checkHealth } from '../services/api';
import GlobalFilterBar from '../components/GlobalFilterBar';

export default function Topbar() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then(() => !cancelled && setStatus('online'))
      .catch(() => !cancelled && setStatus('offline'));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box
      sx={{
        minHeight: 56,
        px: 3,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        top: 0,
        backgroundColor: 'background.default',
        zIndex: 5,
        flexWrap: 'wrap',
      }}
    >
      <GlobalFilterBar />
      <Chip
        size="small"
        label={status === 'online' ? 'API connected' : status === 'offline' ? 'API unreachable' : 'Checking…'}
        color={status === 'online' ? 'success' : status === 'offline' ? 'error' : 'default'}
        variant="outlined"
      />
    </Box>
  );
}
