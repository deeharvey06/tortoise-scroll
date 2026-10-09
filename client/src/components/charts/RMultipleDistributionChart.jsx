import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { palette } from '@/theme/theme';
import { tooltipStyle, axisStyle } from '@/components/charts/chartStyles';

export default function RMultipleDistributionChart({ data }) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <BarChart data={data} margin={{ left: 0, right: 8, bottom: 28 }}>
        <CartesianGrid
          strokeDasharray='3 3'
          stroke={palette.border}
          vertical={false}
        />
        <XAxis
          dataKey='label'
          tick={axisStyle}
          interval={0}
          angle={-24}
          textAnchor='end'
          height={54}
        />
        <YAxis tick={axisStyle} allowDecimals={false} width={28} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--ts-surface-hover)' }}
        />
        <Bar
          dataKey='count'
          name='Trades'
          fill={palette.neutralAmber}
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
