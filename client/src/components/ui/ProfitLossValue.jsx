import Box from '@mui/material/Box';

function formatValue(value, currency, precision, showSign) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  const formatted = currency
    ? Math.abs(number).toLocaleString(undefined, { style: 'currency', currency, minimumFractionDigits: precision, maximumFractionDigits: precision })
    : Math.abs(number).toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
  if (number < 0) return `−${formatted}`;
  return number > 0 && showSign ? `+${formatted}` : formatted;
}

export default function ProfitLossValue({ value, currency = 'USD', precision = 2, showSign = true, prefix, suffix, component = 'span', sx, ...props }) {
  const number = Number(value);
  const tone = number > 0 ? 'success.main' : number < 0 ? 'error.main' : 'text.primary';
  const label = number > 0 ? 'Profit' : number < 0 ? 'Loss' : 'Flat';
  return (
    <Box
      component={component}
      className="financial-number"
      aria-label={`${label}: ${formatValue(value, currency, precision, showSign)}`}
      sx={{ color: tone, fontWeight: 600, ...sx }}
      {...props}
    >
      {prefix}{formatValue(value, currency, precision, showSign)}{suffix}
    </Box>
  );
}
