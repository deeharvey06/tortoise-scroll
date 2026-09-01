import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const tooltipStyle = {
  background: 'var(--ts-surface-secondary)',
  border: '1px solid var(--ts-border-default)',
  borderRadius: 'var(--ts-radius-sm)',
  color: 'var(--ts-text-primary)',
  fontSize: 12,
  boxShadow: 'var(--ts-shadow-sm)',
};

function ComparisonTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <Box sx={{ ...tooltipStyle, p: 2.5 }}>
      <Typography variant='subtitle2' sx={{ mb: 1 }}>{row.label}</Typography>
      <Typography variant='caption' display='block'>Net P&amp;L: {row.netPnL < 0 ? '−' : '+'}${Math.abs(row.netPnL).toFixed(2)}</Typography>
      <Typography variant='caption' display='block'>Sample: {row.count} trade{row.count === 1 ? '' : 's'}</Typography>
      {row.winRate != null && <Typography variant='caption' display='block'>Win rate: {row.winRate}%</Typography>}
      {row.avgR != null && <Typography variant='caption' display='block'>Average R: {row.avgR.toFixed(2)}R</Typography>}
    </Box>
  );
}

export default function ComparisonBarChart({ rows = [], height = 260 }) {
  const data = rows.slice(0, 12);
  if (!data.length) return null;
  return (
    <Box sx={{ width: '100%', height }} role='img' aria-label={`Net profit and loss comparison across ${data.length} groups`}>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} layout='vertical' margin={{ top: 4, right: 16, bottom: 4, left: 12 }}>
          <CartesianGrid strokeDasharray='3 3' stroke='var(--ts-chart-grid)' horizontal={false} />
          <XAxis type='number' tick={{ fill: 'var(--ts-chart-axis)', fontSize: 11 }} tickFormatter={(value) => `$${value}`} axisLine={false} tickLine={false} />
          <YAxis type='category' dataKey='label' width={92} tick={{ fill: 'var(--ts-chart-axis)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ComparisonTooltip />} cursor={{ fill: 'var(--ts-surface-hover)' }} />
          <Bar dataKey='netPnL' radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((row) => <Cell key={row.key} fill={row.netPnL >= 0 ? 'var(--ts-financial-positive)' : 'var(--ts-financial-negative)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
