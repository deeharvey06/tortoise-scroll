import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

export default function TableLayoutDialog({
  columns,
  visible,
  setVisible,
  density,
  setDensity,
  onSave,
  busy,
  error,
}) {
  const [open, setOpen] = useState(false);
  const order = [
    ...visible,
    ...columns.map((c) => c.id).filter((id) => !visible.includes(id)),
  ];

  function move(id, delta) {
    const next = [...visible],
      i = next.indexOf(id);
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setVisible(next);
  }

  return (
    <>
      <Button size='small' onClick={() => setOpen(true)}>
        Table layout
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        fullWidth
        maxWidth='sm'
        aria-labelledby='table-layout-title'
      >
        <DialogTitle id='table-layout-title'>Table layout</DialogTitle>
        <DialogContent>
          {error && <Alert severity='error'>{error}</Alert>}
          <Typography variant='body2' sx={{ mb: 2 }}>
            Save columns, their order, density, current sorting, search and
            global filters to your account.
          </Typography>
          <TextField
            select
            fullWidth
            label='Table density'
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value='compact'>Compact</MenuItem>
            <MenuItem value='comfortable'>Comfortable</MenuItem>
          </TextField>
          {order.map((id) => {
            const col = columns.find((c) => c.id === id),
              i = visible.indexOf(id);
            return (
              <Stack
                key={id}
                direction='row'
                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
              >
                <FormControlLabel
                  sx={{ flex: 1 }}
                  control={
                    <Checkbox
                      checked={i >= 0}
                      disabled={col.required}
                      onChange={() =>
                        setVisible(
                          i >= 0
                            ? visible.filter((v) => v !== id)
                            : [...visible, id]
                        )
                      }
                    />
                  }
                  label={col.label}
                />
                <Button
                  aria-label={`Move ${col.label} earlier`}
                  disabled={i <= 0}
                  onClick={() => move(id, -1)}
                >
                  Up
                </Button>
                <Button
                  aria-label={`Move ${col.label} later`}
                  disabled={i < 0 || i === visible.length - 1}
                  onClick={() => move(id, 1)}
                >
                  Down
                </Button>
              </Stack>
            );
          })}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (await onSave()) setOpen(false);
            }}
          >
            {busy ? 'Saving…' : 'Save layout'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
