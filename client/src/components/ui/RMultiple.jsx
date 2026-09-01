import Box from '@mui/material/Box';

export default function RMultiple({ value, precision = 2, component = 'span', colorByValue = true, sx, ...props }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return <Box component={component} sx={{ color: 'text.muted', ...sx }} {...props}>—</Box>;
  const number = Number(value);
  return (
    <Box
      component={component}
      className="financial-number"
      aria-label={`R multiple: ${number.toFixed(precision)} R`}
      sx={{ color: colorByValue ? (number > 0 ? 'success.main' : number < 0 ? 'error.main' : 'text.primary') : 'text.primary', fontWeight: 600, ...sx }}
      {...props}
    >
      {number > 0 ? '+' : number < 0 ? '−' : ''}{Math.abs(number).toFixed(precision)}R
    </Box>
  );
}
