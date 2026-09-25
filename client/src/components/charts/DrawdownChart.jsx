import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

export default function DrawdownChart({ data }) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid
          strokeDasharray='3 3'
          stroke={palette.border}
          vertical={false}
        />
        <XAxis
          dataKey='date'
          tick={axisStyle}
          tickFormatter={(date) => new Date(date).toLocaleDateString()}
          minTickGap={36}
        />
        <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={52} />
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
        <Area
          type='monotone'
          dataKey='drawdown'
          name='Drawdown'
          stroke={palette.loss}
          fill={palette.loss}
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
