import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

// Reserve space even when idle so a refresh never shifts the content below it.
export default function RefreshStatus({ refreshing }) {
  return (
    <Box sx={{ height: 4, mb: 1 }}>
      {refreshing && <LinearProgress aria-label='Updating results' />}
    </Box>
  );
}
