import { useId } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

export default function ConfirmationDialog({
  open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', onConfirm, onClose, loading = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} maxWidth="xs" fullWidth>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {description && <DialogContentText id={descriptionId}>{description}</DialogContentText>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button color={tone === 'danger' ? 'error' : 'primary'} variant="contained" onClick={onConfirm} disabled={loading} startIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
