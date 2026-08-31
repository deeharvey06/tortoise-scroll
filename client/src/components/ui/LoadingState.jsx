import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

export default function LoadingState({ label = 'Loading…', compact = false, skeletonRows = 0, sx }) {
  if (skeletonRows > 0) {
    return (
      <Box role="status" aria-label={label} sx={{ py: 2, ...sx }}>
        {Array.from({ length: skeletonRows }, (_, index) => <Skeleton key={index} height={compact ? 36 : 44} sx={{ mb: 1 }} />)}
      </Box>
    );
  }
  return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: compact ? 64 : 160, color: 'text.secondary', ...sx }}>
      <CircularProgress size={compact ? 16 : 22} thickness={4} />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
}
