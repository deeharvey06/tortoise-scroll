import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import { ProfitLossValue } from '@/components/ui';

export default function GroupTable({ rows, keyLabel }) {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant='body2' color='text.secondary'>
        No closed trades in this range.
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size='small' aria-label={`${keyLabel} comparison`}>
        <TableHead>
          <TableRow>
            <TableCell>{keyLabel}</TableCell>
            <TableCell align='right'>Trades</TableCell>
            <TableCell align='right'>Win rate</TableCell>
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
              <TableCell align='right'>
                <ProfitLossValue value={r.netPnL} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
