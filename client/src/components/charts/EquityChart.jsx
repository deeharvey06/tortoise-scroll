import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

import { palette } from '@/theme/theme';
import { axisStyle } from '@/components/charts/chartStyles';
import { fmtAxisMoney } from '@/utils/financialFormatting';
import MoneyTooltip from '@/components/charts/MoneyTooltip';

export default function EquityChart({ data }) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray='3 3'
          stroke={palette.border}
          vertical={false}
        />
        <XAxis
          dataKey='date'
          tick={axisStyle}
          tickFormatter={(date) => new Date(date).toLocaleDateString()}
          minTickGap={28}
        />
        <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={56} />
        <ReferenceLine
          y={0}
          stroke={palette.text.secondary}
          strokeOpacity={0.55}
        />
        <Tooltip
          content={
            <MoneyTooltip
              labelFormatter={(date) => new Date(date).toLocaleString()}
            />
          }
        />
        <Line
          type='monotone'
          dataKey='equity'
          name='Equity'
          stroke={palette.accent.main}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
