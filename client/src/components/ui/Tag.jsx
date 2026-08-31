import Chip from '@mui/material/Chip';

export default function Tag({ label, onDelete, selected = false, sx, ...props }) {
  return (
    <Chip
      size="small"
      label={label}
      onDelete={onDelete}
      variant={selected ? 'filled' : 'outlined'}
      color={selected ? 'primary' : 'default'}
      sx={{ maxWidth: 180, ...sx }}
      {...props}
    />
  );
}
