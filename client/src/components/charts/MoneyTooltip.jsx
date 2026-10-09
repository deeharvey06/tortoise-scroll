import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { tooltipStyle } from '@/components/charts/chartStyles';

import { fmtMoney } from '@/utils/financialFormatting';

export default function MoneyTooltip({
  active,
  payload,
  label,
  labelFormatter,
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const formattedLabel = labelFormatter ? labelFormatter(label) : label;

  return (
    <Box sx={{ ...tooltipStyle, p: 3 }}>
      {formattedLabel && (
        <Typography
          variant='caption'
          color='text.secondary'
          sx={{ display: 'block', mb: 1 }}
        >
          {formattedLabel}
        </Typography>
      )}
      <Typography
        variant='body2'
        className='financial-number'
        sx={{ fontWeight: 700 }}
      >
        {point.name}: {fmtMoney(point.value)}
      </Typography>
    </Box>
  );
}
