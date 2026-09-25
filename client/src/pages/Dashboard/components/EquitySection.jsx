import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

import ChartPanel from '@/components/charts/ChartPanel';
import EquityChart from '@/components/charts/EquityChart';
import DrawdownChart from '@/components/charts/DrawdownChart';

export default function EquitySection({ data, summary, hasClosed }) {
  return (
    <Box component='section' aria-label='Equity and drawdown' sx={{ mb: 8 }}>
      <Grid container spacing={4}>
        <Grid item xs={12} lg={8}>
          <ChartPanel
            title='Equity curve'
            description={`Cumulative closed-trade P&L · ${summary.closedTrades} trade sample`}
            empty={!hasClosed}
            height={360}
            testId='chart-equity-curve'
          >
            <EquityChart data={data.equityCurve} />
          </ChartPanel>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ChartPanel
            title='Drawdown'
            description='Distance below the running equity peak'
            empty={!hasClosed}
            height={360}
            testId='chart-drawdown'
          >
            <DrawdownChart data={data.drawdownCurve} />
          </ChartPanel>
        </Grid>
      </Grid>
    </Box>
  );
}
