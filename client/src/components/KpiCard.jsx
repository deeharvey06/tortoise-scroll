import { memo } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

function pnlColor(value) {
  if (value === null || value === undefined) return 'text.primary';
  return value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary';
}

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Dashboard/Reports/Strategies/Playbooks/Risk pages each render a dozen-plus
// of these per view. Memoized since the vast majority of re-renders on
// those pages are triggered by state unrelated to a given card's own
// label/value/suffix (e.g. typing in an unrelated filter field).
function KpiCard({ label, value, colorByValue = false, suffix = '' }) {
  const display = value === null || value === undefined ? '—' : `${value}${suffix}`;
  return (
    <Paper sx={{ p: 1.75, height: '100%' }} data-testid={`kpi-${slugify(label)}`}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        className="mono-data"
        data-testid={`kpi-${slugify(label)}-value`}
        sx={{ fontWeight: 700, color: colorByValue ? pnlColor(value) : 'text.primary' }}
      >
        {display}
      </Typography>
    </Paper>
  );
}

export default memo(KpiCard);
