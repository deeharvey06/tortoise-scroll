import { memo } from 'react';
import Typography from '@mui/material/Typography';
import Panel from './Panel';

function numericSign(value) {
  if (typeof value === 'number') return Math.sign(value);
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? Math.sign(parsed) : 0;
}

function slugify(label) { return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

function MetricCard({ label, value, colorByValue = false, suffix = '', supportingText, tone, emphasis = 'standard', sx }) {
  const display = value === null || value === undefined ? '—' : `${value}${suffix}`;
  const sign = numericSign(value);
  const color = tone === 'positive' || (colorByValue && sign > 0)
    ? 'success.main'
    : tone === 'negative' || (colorByValue && sign < 0)
      ? 'error.main'
      : tone === 'warning' ? 'warning.main' : 'text.primary';

  return (
    <Panel padding={emphasis === 'primary' ? 5 : 3.5} sx={{ height: '100%', minHeight: emphasis === 'primary' ? 108 : 78, ...sx }} data-testid={`kpi-${slugify(label)}`}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{label}</Typography>
      <Typography variant={emphasis === 'primary' ? 'h4' : 'h6'} className="financial-number" data-testid={`kpi-${slugify(label)}-value`} sx={{ color, fontWeight: 700 }}>
        {display}
      </Typography>
      {supportingText && <Typography variant="caption" color="text.muted" sx={{ display: 'block', mt: 1 }}>{supportingText}</Typography>}
    </Panel>
  );
}

export default memo(MetricCard);
