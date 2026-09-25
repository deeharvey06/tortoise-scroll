import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import {
  EmptyState,
  Panel,
  ProfitLossValue,
  RMultiple,
  SectionHeader,
} from '@/components/ui';

import { ComparisonBarChart } from '@/components/charts';

export default function BreakdownTable({ title, rows }) {
  return (
    <Panel sx={{ height: '100%' }}>
      <SectionHeader title={title} component='h2' />
      {rows.length === 0 ? (
        <EmptyState
          compact
          title='No closed trades'
          description='Adjust the selected range or filters to expand this analysis.'
        />
      ) : (
        <>
          <ComparisonBarChart rows={rows} />
          <Box sx={{ overflowX: 'auto', mt: 2 }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>{title.replace('P&L by ', '')}</TableCell>
                  <TableCell align='right'>Trades</TableCell>
                  <TableCell align='right'>Win rate</TableCell>
                  <TableCell align='right'>Avg R</TableCell>
                  <TableCell align='right'>Profit factor</TableCell>
                  <TableCell align='right'>Net P&L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} hover>
                    <TableCell>{r.label}</TableCell>
                    <TableCell align='right' className='mono-data'>
                      {r.count}
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      {r.winRate !== null ? `${r.winRate}%` : '—'}
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      <RMultiple value={r.avgR} colorByValue={false} />
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      {r.profitFactor !== null
                        ? r.profitFactor.toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell align='right'>
                      <ProfitLossValue value={r.netPnL} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}
    </Panel>
  );
}
