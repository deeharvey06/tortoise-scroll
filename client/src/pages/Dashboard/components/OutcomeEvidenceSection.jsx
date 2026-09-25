import { routes } from '@/config/routes';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { MetricCard, Panel, SectionHeader } from '@/components/ui';

import { fmtMoney, fmtDuration } from '@/utils/financialFormatting';

export default function OutcomeEvidenceSection({ summary }) {
  return (
    <Box
      component='section'
      aria-label='Sample and outcome evidence'
      sx={{ mb: 8 }}
    >
      <Grid container spacing={4}>
        <Grid item xs={12} lg={8}>
          <Panel>
            <SectionHeader
              title='Outcome evidence'
              description='Supporting metrics behind the headline result'
              component='h2'
            />
            <Grid container spacing={3}>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Gross P&L'
                  value={fmtMoney(summary.grossPnL)}
                  colorByValue
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Avg winner'
                  value={fmtMoney(summary.avgWin)}
                  colorByValue
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Avg loser'
                  value={fmtMoney(summary.avgLoss)}
                  colorByValue
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Largest winner'
                  value={fmtMoney(summary.largestWinner)}
                  colorByValue
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Largest loser'
                  value={fmtMoney(summary.largestLoser)}
                  colorByValue
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Avg holding time'
                  value={fmtDuration(summary.avgHoldingTimeSeconds)}
                />
              </Grid>
            </Grid>
          </Panel>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Panel
            sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <SectionHeader
              title='Process review'
              description='Review behavior and rule adherence alongside profitability.'
              component='h2'
            />
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={6} sm={4}>
                <MetricCard label='Total trades' value={summary.totalTrades} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Closed trades'
                  value={summary.closedTrades}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard label='Open trades' value={summary.openTrades} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Winning trades'
                  value={summary.winningTrades}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Losing trades'
                  value={summary.losingTrades}
                />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricCard
                  label='Loss rate'
                  value={summary.lossRate}
                  suffix='%'
                />
              </Grid>
            </Grid>
            <Button
              component={RouterLink}
              to={routes.reports}
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 'auto', alignSelf: 'flex-start' }}
            >
              Review process evidence
            </Button>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
