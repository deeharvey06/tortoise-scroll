import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

import { palette } from '@/theme/theme';
import { axisStyle } from '@/components/charts/chartStyles';
import { fmtAxisMoney } from '@/utils/financialFormatting';
import MoneyTooltip from '@/components/charts/MoneyTooltip';

export default function OutcomeBars({
  data,
  dataKey = 'netPnL',
  categoryKey = 'label',
  layout,
  categoryWidth = 64,
}) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <BarChart
        data={data}
        layout={layout}
        margin={
          layout === 'vertical'
            ? { left: 12, right: 12 }
            : { top: 4, right: 8, left: 0, bottom: 4 }
        }
      >
        <CartesianGrid
          strokeDasharray='3 3'
          stroke={palette.border}
          vertical={layout !== 'vertical'}
          horizontal
        />
        {layout === 'vertical' ? (
          <>
            <XAxis
              type='number'
              tick={axisStyle}
              tickFormatter={fmtAxisMoney}
            />
            <YAxis
              type='category'
              dataKey={categoryKey}
              tick={axisStyle}
              width={categoryWidth}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} tick={axisStyle} />
            <YAxis tick={axisStyle} tickFormatter={fmtAxisMoney} width={48} />
          </>
        )}
        <ReferenceLine
          x={layout === 'vertical' ? 0 : undefined}
          y={layout === 'vertical' ? undefined : 0}
          stroke={palette.text.secondary}
          strokeOpacity={0.55}
        />
        <Tooltip
          content={<MoneyTooltip />}
          cursor={{ fill: 'var(--ts-surface-hover)' }}
        />
        <Bar
          dataKey={dataKey}
          name='Net P&L'
          radius={layout === 'vertical' ? [0, 3, 3, 0] : [3, 3, 0, 0]}
        >
          {data.map((item, index) => (
            <Cell
              key={`${item.key || item.label || index}`}
              fill={item[dataKey] >= 0 ? palette.profit : palette.loss}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
