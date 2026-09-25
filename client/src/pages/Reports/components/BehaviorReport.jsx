import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import KpiCard from '@/components/KpiCard';
import { Panel, ProfitLossValue, SectionHeader, Tag } from '@/components/ui';

export default function BehaviorReport({ data = {} }) {
  const streaks = data.streaks ?? {};
  const ruleViolations = data.ruleViolations ?? {};
  const mistakes = data.mistakes ?? [];
  const emotions = data.emotions ?? [];

  return (
    <Box>
      <Alert severity='info' sx={{ mb: 2 }}>
        {data.note}
      </Alert>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Longest loss streak'
            value={streaks.longestLossStreak ?? 0}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Avg R after 2+ losses'
            value={streaks.avgRAfterTwoConsecutiveLosses ?? null}
            suffix={
              streaks.avgRAfterTwoConsecutiveLosses !== null &&
              streaks.avgRAfterTwoConsecutiveLosses !== undefined
                ? 'R'
                : ''
            }
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Plan violations'
            value={ruleViolations.violations ?? 0}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <KpiCard
            label='Violation rate'
            value={ruleViolations.violationRate ?? null}
            suffix={
              ruleViolations.violationRate !== null &&
              ruleViolations.violationRate !== undefined
                ? '%'
                : ''
            }
          />
        </Grid>
      </Grid>
      {(streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0) > 0 &&
        (streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0) < 10 && (
          <Alert severity='warning' sx={{ mb: 2 }}>
            Only {streaks.sampleSizeAfterTwoConsecutiveLosses ?? 0} trade(s)
            followed two consecutive losses in this range — too few to draw a
            conclusion from.
          </Alert>
        )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              title='Mistakes tagged on trades'
              description='Frequency, sample size, and associated average outcome.'
            />
            {mistakes.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No trades tagged with a mistake in this range.
              </Typography>
            ) : (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Mistake</TableCell>
                    <TableCell align='right'>Count</TableCell>
                    <TableCell align='right'>Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mistakes.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Tag label={m.tag} />
                      </TableCell>
                      <TableCell align='right' className='mono-data'>
                        {m.count}
                      </TableCell>
                      <TableCell align='right'>
                        <ProfitLossValue value={m.avgPnL} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel sx={{ height: '100%' }}>
            <SectionHeader
              title='Emotions tagged on trades'
              description='Frequency, sample size, and associated average outcome.'
            />
            {emotions.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No trades tagged with an emotion in this range.
              </Typography>
            ) : (
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Emotion</TableCell>
                    <TableCell align='right'>Count</TableCell>
                    <TableCell align='right'>Avg P&L when present</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emotions.map((m) => (
                    <TableRow key={m.tag}>
                      <TableCell>
                        <Tag label={m.tag} />
                      </TableCell>
                      <TableCell align='right' className='mono-data'>
                        {m.count}
                      </TableCell>
                      <TableCell align='right'>
                        <ProfitLossValue value={m.avgPnL} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
