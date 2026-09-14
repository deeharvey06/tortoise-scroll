import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';

import * as importApi from '../../services/importService';
import * as tradeApi from '../../services/tradeService';
import PageHeader from '../../components/PageHeader';
import { Panel, SectionHeader, StatusBadge } from '../../components/ui';

const TARGET_FIELDS = [
  { key: 'symbol', label: 'Symbol', required: true },
  { key: 'direction', label: 'Direction (long/short)', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'entryPrice', label: 'Entry price', required: true },
  { key: 'entryTime', label: 'Entry time', required: true },
  { key: 'exitPrice', label: 'Exit price', required: false },
  { key: 'exitTime', label: 'Exit time', required: false },
  { key: 'stopLoss', label: 'Stop loss', required: false },
  { key: 'fees', label: 'Fees', required: false },
  { key: 'commission', label: 'Commission', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

const STAGES = [
  'Upload',
  'Detect',
  'Map',
  'Validate',
  'Review',
  'Import',
  'Results',
];

export default function ImportPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);

  const [adapters, setAdapters] = useState([]);
  const [broker, setBroker] = useState('generic');
  const [sourceTimezone, setSourceTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');

  const [headers, setHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState({});
  const [importMode, setImportMode] = useState('trade');
  const [executionSummary, setExecutionSummary] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const visualStage =
    activeStep === 0
      ? loading
        ? 1
        : 0
      : activeStep === 1
        ? 2
        : activeStep === 2
          ? loading
            ? 5
            : 4
          : 6;
  const failedRows = job?.rows?.filter((row) => row.outcome === 'error') || [];
  const hasErrorField = failedRows.some((row) => row.field !== undefined);
  const hasErrorValue = failedRows.some((row) => row.value !== undefined);

  useEffect(() => {
    importApi
      .fetchAdapters()
      .then(setAdapters)
      .catch((e) => setError(e.message));
    tradeApi
      .fetchAccounts()
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }, []);

  const handleFileSelect = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Only .csv files are accepted');
      return;
    }
    setError(null);
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const runPreview = useCallback(async () => {
    if (!file) {
      setError('Choose a CSV file first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await importApi.previewCsv(file, broker, sourceTimezone);
      setHeaders(data.headers);
      setPreviewRows(data.previewRows);
      setTotalRows(data.totalRows);
      setMapping(data.suggestedMapping || {});
      setImportMode(data.mode || 'trade');
      setExecutionSummary(data.executionSummary || null);
      setValidationErrors(data.validationErrors || []);
      setValidationWarnings(data.validationWarnings || []);
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [file, broker, sourceTimezone]);

  const missingRequired =
    importMode === 'execution'
      ? []
      : TARGET_FIELDS.filter((f) => f.required && !mapping[f.key]);

  const goToPreviewStep = () => {
    if (missingRequired.length > 0) {
      setError(
        `Map all required fields first: ${missingRequired.map((f) => f.label).join(', ')}`
      );
      return;
    }
    setError(null);
    setActiveStep(2);
  };

  const runCommit = async () => {
    if (!accountId) {
      setError('Choose an account to import into');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await importApi.commitCsv({
        file,
        accountId,
        broker,
        mapping,
        sourceTimezone,
      });
      setJob(result);
      setActiveStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setActiveStep(0);
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({});
    setImportMode('trade');
    setExecutionSummary(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setJob(null);
    setError(null);
  };

  return (
    <Box sx={{ maxWidth: 1120 }}>
      <PageHeader
        eyebrow='System'
        title='Import trades'
        description='Bring broker CSV exports into your permanent trading record through a controlled, reviewable workflow.'
      />

      <Box
        sx={{ overflowX: 'auto', mb: 6, pb: 1 }}
        aria-label='Import progress'
      >
        <Stepper
          activeStep={visualStage}
          alternativeLabel
          sx={{
            minWidth: 680,
            '& .MuiStepLabel-label': { typography: 'caption' },
          }}
        >
          {STAGES.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {error && (
        <Alert severity='error' onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {activeStep === 0 && (
        <Panel>
          <SectionHeader
            eyebrow='Upload'
            title='Choose source file'
            description='Select the broker format, then provide its CSV export. The source file is not modified.'
          />
          <TextField
            select
            label='Broker format'
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            fullWidth
            size='small'
            sx={{ mb: 3, maxWidth: 320 }}
          >
            {adapters.map((a) => (
              <MenuItem key={a.key} value={a.key}>
                {a.label}
              </MenuItem>
            ))}
          </TextField>

          {broker === 'thinkorswim' && (
            <TextField
              label='Statement timezone'
              value={sourceTimezone}
              onChange={(e) => setSourceTimezone(e.target.value)}
              helperText='Thinkorswim execution timestamps often omit a timezone. Use the timezone configured for the broker statement/account.'
              fullWidth
              size='small'
              sx={{ mb: 3, maxWidth: 420 }}
            />
          )}

          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              borderRadius: 1,
              p: 5,
              textAlign: 'center',
              backgroundColor: dragOver ? 'action.hover' : 'transparent',
            }}
          >
            <UploadFileIcon
              sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }}
            />
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
              Drag and drop a CSV export here, or
            </Typography>
            <Button variant='outlined' component='label' size='small'>
              Choose file
              <input
                type='file'
                accept='.csv,text/csv'
                hidden
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </Button>
            {file && (
              <Typography variant='body2' sx={{ mt: 2 }}>
                Selected: <strong>{file.name}</strong>
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant='contained'
              onClick={runPreview}
              disabled={!file || loading}
            >
              {loading ? <CircularProgress size={18} /> : 'Preview'}
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 1 && (
        <Panel>
          <SectionHeader
            eyebrow='Detect · Map'
            title={
              importMode === 'execution'
                ? 'Execution format detected'
                : 'Confirm column mapping'
            }
            description={
              importMode === 'execution'
                ? 'Thinkorswim executions are normalized first, then reconstructed into positions. No broker row is treated as a completed trade.'
                : 'Review the detected headers before any rows are imported.'
            }
          />
          {importMode === 'execution' ? (
            <>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                {totalRows} broker rows detected ·{' '}
                {executionSummary?.executionsDetected ?? 0} valid executions ·{' '}
                {executionSummary?.rejectedRows ?? 0} rejected rows ·{' '}
                {executionSummary?.warnings ?? 0} warnings.
              </Typography>
              {validationWarnings.length > 0 && (
                <Alert severity='warning' sx={{ mb: 2 }}>
                  {validationWarnings
                    .slice(0, 3)
                    .map(
                      (item) => `Row ${item.rowNumber ?? '—'}: ${item.message}`
                    )
                    .join(' · ')}
                </Alert>
              )}
              {validationErrors.length > 0 && (
                <Alert severity='error' sx={{ mb: 2 }}>
                  {validationErrors
                    .slice(0, 3)
                    .map(
                      (item) => `Row ${item.rowNumber ?? '—'}: ${item.message}`
                    )
                    .join(' · ')}
                </Alert>
              )}
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size='small' stickyHeader>
                  <TableHead>
                    <TableRow>
                      {headers.slice(0, 8).map((header) => (
                        <TableCell key={header}>{header}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row, index) => (
                      <TableRow key={index}>
                        {headers.slice(0, 8).map((header) => (
                          <TableCell key={header}>{row[header]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                {totalRows} rows detected. Map each field to a column from your
                file. Fields marked * are required — rows that fail to resolve
                them will be reported as errors, never silently skipped.
              </Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Trade field</TableCell>
                    <TableCell>CSV column</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TARGET_FIELDS.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell>
                        {f.label}
                        {f.required && ' *'}
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size='small'
                          fullWidth
                          value={mapping[f.key] || ''}
                          onChange={(e) =>
                            setMapping((m) => ({
                              ...m,
                              [f.key]: e.target.value || undefined,
                            }))
                          }
                        >
                          <MenuItem value=''>— not mapped —</MenuItem>
                          {headers.map((h) => (
                            <MenuItem key={h} value={h}>
                              {h}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button variant='contained' onClick={goToPreviewStep}>
              Continue
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 2 && (
        <Panel>
          <SectionHeader
            eyebrow='Validate · Review'
            title={
              importMode === 'execution'
                ? 'Review detected executions'
                : 'Review interpreted trades'
            }
            description={
              importMode === 'execution'
                ? 'Choose the destination account. Thinkorswim fills will be added to the execution ledger and reconstructed using FIFO position accounting.'
                : 'Choose the destination account and verify how the mapped values will be interpreted.'
            }
          />
          <TextField
            select
            label='Import into account'
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            fullWidth
            size='small'
            required
            sx={{ mb: 3, maxWidth: 320 }}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant='body2' sx={{ mb: 1 }}>
            First {previewRows.length} of {totalRows}{' '}
            {importMode === 'execution'
              ? 'execution rows detected from the broker statement:'
              : `rows, as they'll be interpreted with your mapping:`}
          </Typography>
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  {importMode === 'execution'
                    ? headers
                        .slice(0, 8)
                        .map((header) => (
                          <TableCell key={header}>{header}</TableCell>
                        ))
                    : TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <TableCell key={f.key}>{f.label}</TableCell>
                      ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {importMode === 'execution'
                      ? headers
                          .slice(0, 8)
                          .map((header) => (
                            <TableCell key={header}>{row[header]}</TableCell>
                          ))
                      : TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                          <TableCell key={f.key}>
                            {row[mapping[f.key]]}
                          </TableCell>
                        ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setActiveStep(1)}>Back</Button>
            <Button
              variant='contained'
              onClick={runCommit}
              disabled={loading || !accountId}
            >
              {loading ? (
                <CircularProgress size={18} />
              ) : (
                `Import ${totalRows} rows`
              )}
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 3 && job && (
        <Panel>
          <SectionHeader
            eyebrow='Results'
            title='Import completed'
            description='Every submitted row is accounted for below.'
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <StatusBadge
              label={
                job.mode === 'execution'
                  ? `${job.summary.tradesReconstructed ?? 0} new trades`
                  : `${job.summary.imported} imported`
              }
              tone='positive'
            />
            <StatusBadge
              label={
                job.mode === 'execution'
                  ? `${job.summary.duplicates} duplicate executions skipped`
                  : `${job.summary.duplicates} duplicates skipped`
              }
              tone='warning'
            />
            <StatusBadge
              label={`${job.summary.errors} errors`}
              tone={job.summary.errors > 0 ? 'negative' : 'neutral'}
            />
          </Box>

          {job.mode === 'execution' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <StatusBadge
                label={`${job.summary.executionsDetected ?? 0} executions detected`}
                tone='neutral'
              />
              <StatusBadge
                label={`${job.summary.executionsImported ?? 0} executions added`}
                tone='positive'
              />
              <StatusBadge
                label={`${job.summary.tradesReconstructed ?? 0} trades reconstructed`}
                tone='positive'
              />
              <StatusBadge
                label={`${job.summary.tradesUpdated ?? 0} trades updated`}
                tone='neutral'
              />
              <StatusBadge
                label={`${job.summary.openPositions ?? 0} open positions`}
                tone='neutral'
              />
              <StatusBadge
                label={`${job.summary.warnings ?? 0} warnings`}
                tone={job.summary.warnings > 0 ? 'warning' : 'neutral'}
              />
              <StatusBadge
                label={`${job.summary.rejectedRows ?? 0} rejected rows`}
                tone={job.summary.rejectedRows > 0 ? 'negative' : 'neutral'}
              />
            </Box>
          )}

          {job.summary.errors > 0 && (
            <>
              <Typography variant='subtitle2' sx={{ mb: 1 }}>
                Rows that failed — nothing was silently discarded
              </Typography>
              <TableContainer sx={{ maxHeight: 300, mb: 2 }}>
                <Table size='small' stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      {hasErrorField && <TableCell>Field</TableCell>}
                      {hasErrorValue && <TableCell>Value</TableCell>}
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failedRows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell>{r.rowNumber}</TableCell>
                        {hasErrorField && (
                          <TableCell>{r.field ?? '—'}</TableCell>
                        )}
                        {hasErrorValue && (
                          <TableCell className='financial-number'>
                            {r.value ?? '—'}
                          </TableCell>
                        )}
                        <TableCell>{r.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          <Button variant='contained' onClick={startOver}>
            Import another file
          </Button>
        </Panel>
      )}
    </Box>
  );
}
