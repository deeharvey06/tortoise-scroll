import {
  Alert,
  Box,
  Stack,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

export default function ResultDetails({ result }) {
  const rejected =
    result.events?.filter((event) => event.type === 'rejectedEntry') || [];
  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {!result.engineVersion && (
        <Alert severity='warning'>
          Archived proof-of-concept result. Re-run to apply corrected next-bar
          fills and gap handling.
        </Alert>
      )}
      {result.provenance?.compatibility && (
        <Alert severity='warning'>{result.provenance.compatibility}</Alert>
      )}
      {rejected.length > 0 && (
        <Alert severity='warning'>
          {rejected.length} entry orders rejected: {rejected[0].reason}.
        </Alert>
      )}
      {!result.trades.length && (
        <Alert severity='info'>
          No closed trades. Check signal warm-up, rules, range and pending/open
          positions below.
        </Alert>
      )}
      {result.contract && (
        <Typography>
          Currency: {result.contract.currency || 'Legacy unspecified'} ·
          Multiplier: {result.contract.contractMultiplier} · Tick:{' '}
          {result.contract.tickSize}
        </Typography>
      )}
      {result.provenance?.dataset && (
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          Source: {result.provenance.dataset.id} · Revision:{' '}
          {result.provenance.dataset.revision} · Timezone:{' '}
          {result.provenance.timezone}
        </Typography>
      )}
      {result.assumptions && (
        <Box>
          <Typography variant='h6'>Executed assumptions</Typography>
          <Box
            component='pre'
            sx={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontSize: 12,
            }}
          >
            {JSON.stringify(result.assumptions, null, 2)}
          </Box>
        </Box>
      )}
      {result.strategy && (
        <Box component='details'>
          <Box component='summary'>Executed strategy definition</Box>
          <Box component='pre' sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(result.strategy, null, 2)}
          </Box>
        </Box>
      )}
      {result.openPosition && (
        <Alert severity='warning'>
          Open position: {result.openPosition.quantity} @{' '}
          {result.openPosition.entryPrice}. Mark-to-close unrealized P&amp;L
          after entry commission: {result.openPosition.unrealizedPnL}. Excluded
          from realized trade statistics.
        </Alert>
      )}
      {result.pendingOrder && (
        <Alert severity='info'>
          Unfilled order at end of data: {result.pendingOrder.type}. No future
          fill is assumed.
        </Alert>
      )}
      {result.summary.totalR !== undefined && (
        <Typography>
          Total R: {result.summary.totalR ?? '—'} · Average R:{' '}
          {result.summary.avgR ?? '—'}
        </Typography>
      )}
      {!!result.trades.length && (
        <>
          <Typography variant='h6'>Simulated trades</Typography>
          <Typography variant='caption'>
            UTC times; intrabar events are recorded at bar close because their
            exact time is unknown. Equity/drawdown use realized closed trades
            from zero.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  {[
                    'Entry UTC',
                    'Exit UTC',
                    'Entry',
                    'Exit',
                    'Reason',
                    'Net P&L',
                    'R',
                  ].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {result.trades.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell>{t.entryTime}</TableCell>
                    <TableCell>{t.exitTime}</TableCell>
                    <TableCell>{t.entryPrice}</TableCell>
                    <TableCell>{t.exitPrice}</TableCell>
                    <TableCell>{t.exitReason}</TableCell>
                    <TableCell>{t.netPnL}</TableCell>
                    <TableCell>{t.rMultiple ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}
      {result.breakdown && (
        <Box>
          <Typography variant='h6'>Strategy / setup breakdown</Typography>
          {['strategy', 'setup'].map((kind) => (
            <Box
              key={kind}
              component='pre'
              sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}
            >
              {kind}: {JSON.stringify(result.breakdown[kind], null, 2)}
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}
