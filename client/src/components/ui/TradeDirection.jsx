import Chip from '@mui/material/Chip';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthEastIcon from '@mui/icons-material/SouthEast';

export default function TradeDirection({ direction, size = 'small', sx }) {
  const isLong = direction === 'long';
  return (
    <Chip
      size={size}
      icon={isLong ? <NorthEastIcon /> : <SouthEastIcon />}
      label={isLong ? 'Long' : 'Short'}
      color={isLong ? 'success' : 'error'}
      variant="outlined"
      sx={{ textTransform: 'capitalize', ...sx }}
    />
  );
}
