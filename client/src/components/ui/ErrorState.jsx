import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';

export default function ErrorState({ title = 'Unable to load this view', message, onRetry, compact = false, onClose, sx }) {
  return (
    <Alert severity="error" onClose={onClose} sx={{ alignItems: 'flex-start', py: compact ? 1 : 2, ...sx }}>
      {!compact && <AlertTitle>{title}</AlertTitle>}
      {message || title}
      {onRetry && <Button size="small" color="inherit" onClick={onRetry} sx={{ display: 'block', mt: 2 }}>Try again</Button>}
    </Alert>
  );
}
