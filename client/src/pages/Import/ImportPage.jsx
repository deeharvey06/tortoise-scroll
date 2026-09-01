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

const STAGES = ['Upload', 'Detect', 'Map', 'Validate', 'Review', 'Import', 'Results'];

export default function ImportPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);

  const [adapters, setAdapters] = useState([]);
  const [broker, setBroker] = useState('generic');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');

  const [headers, setHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState({});

  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState(null);
  const visualStage = activeStep === 0 ? (loading ? 1 : 0) : activeStep === 1 ? 2 : activeStep === 2 ? (loading ? 5 : 4) : 6;
  const failedRows = job?.rows?.filter((row) => row.outcome === 'error') || [];
  const hasErrorField = failedRows.some((row) => row.field !== undefined);
  const hasErrorValue = failedRows.some((row) => row.value !== undefined);

  useEffect(() => {
    importApi.fetchAdapters().then(setAdapters).catch((e) => setError(e.message));
    tradeApi.fetchAccounts().then(setAccounts).catch((e) => setError(e.message));
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
      const data = await importApi.previewCsv(file, broker);
      setHeaders(data.headers);
      setPreviewRows(data.previewRows);
      setTotalRows(data.totalRows);
      setMapping(data.suggestedMapping || {});
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [file, broker]);

  const missingRequired = TARGET_FIELDS.filter((f) => f.required && !mapping[f.key]);

  const goToPreviewStep = () => {
    if (missingRequired.length > 0) {
      setError(`Map all required fields first: ${missingRequired.map((f) => f.label).join(', ')}`);
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
      const result = await importApi.commitCsv({ file, accountId, broker, mapping });
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
    setJob(null);
    setError(null);
  };

  return (
    <Box sx={{ maxWidth: 1120 }}>
      <PageHeader eyebrow="System" title="Import trades" description="Bring broker CSV exports into your permanent trading record through a controlled, reviewable workflow." />

      <Stepper activeStep={visualStage} alternativeLabel sx={{ mb: 6, '& .MuiStepLabel-label': { typography: 'caption' } }}>
        {STAGES.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {activeStep === 0 && (
        <Panel>
          <SectionHeader eyebrow="Upload" title="Choose source file" description="Select the broker format, then provide its CSV export. The source file is not modified." />
          <TextField
            select
            label="Broker format"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 3, maxWidth: 320 }}
          >
            {adapters.map((a) => (
              <MenuItem key={a.key} value={a.key}>
                {a.label}
              </MenuItem>
            ))}
          </TextField>

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
            <UploadFileIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Drag and drop a CSV export here, or
            </Typography>
            <Button variant="outlined" component="label" size="small">
              Choose file
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </Button>
            {file && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                Selected: <strong>{file.name}</strong>
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={runPreview} disabled={!file || loading}>
              {loading ? <CircularProgress size={18} /> : 'Preview'}
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 1 && (
        <Panel>
          <SectionHeader eyebrow="Detect · Map" title="Confirm column mapping" description="Review the detected headers before any rows are imported." />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {totalRows} rows detected. Map each field to a column from your file. Fields marked * are required —
            rows that fail to resolve them will be reported as errors, never silently skipped.
          </Typography>
          <Table size="small">
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
                      size="small"
                      fullWidth
                      value={mapping[f.key] || ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                    >
                      <MenuItem value="">— not mapped —</MenuItem>
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

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setActiveStep(0)}>Back</Button>
            <Button variant="contained" onClick={goToPreviewStep}>
              Continue
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 2 && (
        <Panel>
          <SectionHeader eyebrow="Validate · Review" title="Review interpreted trades" description="Choose the destination account and verify how the mapped values will be interpreted." />
          <TextField
            select
            label="Import into account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            fullWidth
            size="small"
            required
            sx={{ mb: 3, maxWidth: 320 }}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="body2" sx={{ mb: 1 }}>
            First {previewRows.length} of {totalRows} rows, as they'll be interpreted with your mapping:
          </Typography>
          <TableContainer sx={{ maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <TableCell key={f.key}>{f.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <TableCell key={f.key}>{row[mapping[f.key]]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setActiveStep(1)}>Back</Button>
            <Button variant="contained" onClick={runCommit} disabled={loading || !accountId}>
              {loading ? <CircularProgress size={18} /> : `Import ${totalRows} rows`}
            </Button>
          </Box>
        </Panel>
      )}

      {activeStep === 3 && job && (
        <Panel>
          <SectionHeader eyebrow="Results" title="Import completed" description="Every submitted row is accounted for below." />
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <StatusBadge label={`${job.summary.imported} imported`} tone="positive" />
            <StatusBadge label={`${job.summary.duplicates} duplicates skipped`} tone="warning" />
            <StatusBadge label={`${job.summary.errors} errors`} tone={job.summary.errors > 0 ? 'negative' : 'neutral'} />
          </Box>

          {job.summary.errors > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Rows that failed — nothing was silently discarded
              </Typography>
              <TableContainer sx={{ maxHeight: 300, mb: 2 }}>
                <Table size="small" stickyHeader>
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
                          {hasErrorField && <TableCell>{r.field ?? '—'}</TableCell>}
                          {hasErrorValue && <TableCell className="financial-number">{r.value ?? '—'}</TableCell>}
                          <TableCell>{r.message}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          <Button variant="contained" onClick={startOver}>
            Import another file
          </Button>
        </Panel>
      )}
    </Box>
  );
}
