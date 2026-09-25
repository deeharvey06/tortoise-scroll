import { palette } from '@/theme/theme';
export const tooltipStyle = {
  backgroundColor: palette.background.elevated,
  border: `1px solid ${palette.border}`,
  borderRadius: 8,
  color: 'var(--ts-text-primary)',
  fontFamily: 'var(--ts-font-numeric)',
  fontSize: 12,
  boxShadow: 'var(--ts-shadow-sm)',
};

export const axisStyle = { fontSize: 10, fill: 'var(--ts-chart-axis)' };
