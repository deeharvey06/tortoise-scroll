import useContextAnalytics from '@/pages/Knowledge/hooks/useContextAnalytics';

import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { Panel } from '@/components/ui';
import { KnowledgePicker } from '@/pages/Knowledge/shared';

export default function ContextAnalytics({ initialIds = [], filters = {} }) {
  const {
    review,
    setReview,
    knowledgeIds,
    setIds,
    followedPlan,
    setPlan,
    scenarioMatched,
    setScenario,
    process,
    setProcess,
    data,
    error,
    busy,
    load,
  } = useContextAnalytics(initialIds, filters);

  return (
    <Panel sx={{ my: 3 }}>
      <Typography variant='h6'>
        My performance by methodology context
      </Typography>
      <Typography color='text.secondary' sx={{ mb: 2 }}>
        All selected concepts must match. These are your observed results,
        separate from course probabilities.
      </Typography>
      <Stack spacing={2}>
        <Typography variant='caption'>
          Current account, date and trade filters also apply when opened from
          Reports or Analytics.
        </Typography>
        {['contextCorrect', 'setupPresent', 'entryValid'].map((key) => (
          <TextField
            key={key}
            select
            label={`Manual review: ${key}`}
            value={review[key] == null ? '' : String(review[key])}
            onChange={(e) => {
              const next = { ...review };
              if (e.target.value === '') delete next[key];
              else next[key] = e.target.value === 'true';
              setReview(next);
            }}
          >
            <MenuItem value=''>All / unknown included</MenuItem>
            <MenuItem value='true'>Yes</MenuItem>
            <MenuItem value='false'>No</MenuItem>
          </TextField>
        ))}
        <KnowledgePicker value={knowledgeIds} onChange={setIds} />
        {[
          [followedPlan, setPlan, 'Followed plan (manual)'],
          [scenarioMatched, setScenario, 'Scenario matched (manual)'],
        ].map(([v, set, label]) => (
          <TextField
            key={label}
            label={label}
            select
            value={v}
            onChange={(e) => set(e.target.value)}
          >
            <MenuItem value=''>All / unreviewed included</MenuItem>
            <MenuItem value='true'>Yes</MenuItem>
            <MenuItem value='false'>No</MenuItem>
          </TextField>
        ))}
        <TextField
          select
          label='Deterministic process finding'
          value={process}
          onChange={(e) => setProcess(e.target.value)}
        >
          <MenuItem value=''>All</MenuItem>
          {[
            'Oversized',
            'Planned Risk Exceeded',
            'Stop Differs From Plan',
            'Early Entry',
            'Late Entry',
            'Chased Entry',
            'Entry Fill Count Exceeded',
          ].map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </TextField>
        <Button disabled={busy} onClick={load}>
          {busy ? 'Calculating…' : 'Compare my trades'}
        </Button>
        {error && <Alert severity='error'>{error}</Alert>}
        {data && (
          <Typography>Closed-trade sample: {data.sampleSize}</Typography>
        )}
        {data && !data.groups.length && (
          <Alert severity='info'>No trades match these filters.</Alert>
        )}
        {data?.groups.map((g) => (
          <Panel key={g.currency}>
            <Typography variant='h6'>
              {g.currency} · {g.sampleSize} closed trades
            </Typography>
            <Typography>
              Wins {g.winningTrades} · Losses {g.losingTrades} · Open{' '}
              {g.openTrades}
            </Typography>
            <Typography>
              Net P&amp;L {g.netPnL ?? 'unavailable'} · Win rate{' '}
              {g.winRate == null ? 'unavailable' : `${g.winRate}%`} · Profit
              factor {g.profitFactor ?? 'undefined'}
            </Typography>
            <Typography>
              Total R {g.totalR ?? 'unavailable'} · Average R{' '}
              {g.avgR ?? 'unavailable'} · R sample {g.rSampleSize}
            </Typography>
            <Typography>
              Expectancy {g.expectancy ?? 'unavailable'} · Maximum drawdown{' '}
              {g.maxDrawdown ?? 'unavailable'}
            </Typography>
            <Typography variant='caption'>{g.interpretation}</Typography>
          </Panel>
        ))}
      </Stack>
    </Panel>
  );
}
