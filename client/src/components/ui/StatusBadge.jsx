import Chip from '@mui/material/Chip';

const COLOR_BY_TONE = { positive: 'success', negative: 'error', warning: 'warning', info: 'info', neutral: 'default' };

export default function StatusBadge({ label, tone = 'neutral', icon, variant = 'outlined', sx, ...props }) {
  return <Chip size="small" label={label} icon={icon} color={COLOR_BY_TONE[tone] || 'default'} variant={variant} sx={{ fontWeight: 600, ...sx }} {...props} />;
}
