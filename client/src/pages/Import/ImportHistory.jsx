import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Typography,
} from '@mui/material';

import api from '../../services/api';
import {
  LoadingState,
  EmptyState,
  Panel,
  SectionHeader,
} from '../../components/ui';

export default function ImportHistory({ refreshKey }) {
  const [jobs, setJobs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [page, setPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api
      .get('/import/jobs', { params: { summary: true, offset } })
      .then(({ data }) => {
        if (active) setJobs(data);
      })
      .catch(() => {
        if (active) setError('Unable to load import history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [offset, refreshKey, retry]);

  useEffect(() => {
    if (!selected) return;
    let active = true;

    setDetails(null);
    setDetailLoading(true);
    setDetailError('');

    api
      .get(`/import/jobs/${selected}/results`, { params: { page } })
      .then(({ data }) => {
        if (active) setDetails(data);
      })
      .catch(() => {
        if (active) setDetailError('Unable to load import results.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected, page, retry]);

  return (
    <Panel sx={{ mt: 4 }}>
      <SectionHeader
        title='Import history'
        description='Import outcomes are preserved. Duplicates are skipped; review the existing trade before making any manual corrections.'
        actions={
          <Button onClick={() => setRetry((v) => v + 1)}>
            Refresh history
          </Button>
        }
      />
      {error && <Alert severity='error'>{error}</Alert>}
      {loading ? (
        <LoadingState label='Loading import history…' />
      ) : !jobs.length ? (
        <EmptyState
          title='No import history'
          description='Completed import attempts will appear here.'
        />
      ) : (
        <TableContainer>
          <Table size='small' aria-label='Import history'>
            <TableHead>
              <TableRow>
                {[
                  'Date / time',
                  'Filename',
                  'Broker',
                  'Account',
                  'Executions detected',
                  'Trades created',
                  'Duplicates skipped',
                  'Warnings',
                  'Errors',
                  'Status',
                  'Results',
                ].map((v) => (
                  <TableCell key={v}>{v}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j._id}>
                  <TableCell>
                    {new Date(j.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{j.originalFilename || 'Unnamed file'}</TableCell>
                  <TableCell>{j.broker}</TableCell>
                  <TableCell>{j.accountName}</TableCell>
                  <TableCell>
                    {j.mode === 'execution'
                      ? j.summary?.executionsDetected
                      : 'Not applicable'}
                  </TableCell>
                  <TableCell>
                    {j.mode === 'execution'
                      ? j.summary?.tradesReconstructed
                      : j.summary?.imported}
                  </TableCell>
                  <TableCell>{j.summary?.duplicates ?? 0}</TableCell>
                  <TableCell>{j.summary?.warnings ?? 0}</TableCell>
                  <TableCell>{j.summary?.errors ?? 0}</TableCell>
                  <TableCell>{j.status}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => {
                        setPage(1);
                        setSelected(j._id);
                      }}
                      aria-label={`View results for ${j.originalFilename}`}
                    >
                      View results
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Stack direction='row'>
        <Button
          disabled={!offset || loading}
          onClick={() => setOffset((v) => Math.max(0, v - 50))}
        >
          Previous imports
        </Button>
        <Button
          disabled={jobs.length < 50 || loading}
          onClick={() => setOffset((v) => v + 50)}
        >
          More imports
        </Button>
      </Stack>
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth='lg'
        fullWidth
        aria-labelledby='import-results-title'
      >
        <DialogTitle id='import-results-title'>
          Detailed import results
        </DialogTitle>
        <DialogContent>
          {detailError && (
            <Alert
              severity='error'
              action={
                <Button onClick={() => setRetry((v) => v + 1)}>Retry</Button>
              }
            >
              {detailError}
            </Alert>
          )}
          {detailLoading && <LoadingState label='Loading import results…' />}
          {details && (
            <>
              <Typography>
                {details.originalFilename} · {details.accountName} ·{' '}
                {details.status}
              </Typography>
              <Typography variant='body2'>
                Trades updated: {details.summary?.tradesUpdated ?? 0} · Open
                positions: {details.summary?.openPositions ?? 0} · Source
                timezone: {details.sourceTimezone || 'Not recorded'}
              </Typography>
              <Alert severity='info' sx={{ my: 2 }}>
                Duplicate policy: Skip. Existing executions, trades and journal
                edits are preserved. Review opens the existing trade when
                linked. Replace and merge are not supported safely by this
                importer.
              </Alert>
              <TableContainer>
                <Table size='small' aria-label='Import row results'>
                  <TableHead>
                    <TableRow>
                      {['Row', 'Outcome', 'Details', 'Review'].map((v) => (
                        <TableCell key={v}>{v}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {details.rows.map((r, i) => (
                      <TableRow key={r._id || i}>
                        <TableCell>{r.rowNumber ?? '—'}</TableCell>
                        <TableCell>
                          {r.outcome === 'duplicate'
                            ? 'Skipped duplicate'
                            : r.outcome}
                        </TableCell>
                        <TableCell>
                          {r.message}
                          {r.field && ` (${r.field})`}
                        </TableCell>
                        <TableCell>
                          {r.tradeId ? (
                            <Button
                              component={Link}
                              to={`/trades/${r.tradeId}`}
                            >
                              Review trade
                            </Button>
                          ) : r.outcome === 'duplicate' ? (
                            'Execution retained; no linked trade'
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {!details.rows.length && (
                <EmptyState title='No row results on this page' />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={page === 1 || detailLoading}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous rows
          </Button>
          <Button
            disabled={!details?.hasMore || detailLoading}
            onClick={() => setPage((v) => v + 1)}
          >
            More rows
          </Button>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}
