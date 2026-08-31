import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Toolbar from '@mui/material/Toolbar';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/HighlightOffOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import Tooltip from '@mui/material/Tooltip';
import { format } from 'date-fns';

import * as tradeApi from '../../services/tradeService';
import useFilterStore, { resolveDateRange } from '../../store/useFilterStore';
import TradeFormDialog from './TradeFormDialog';

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TradesPage() {
  const navigate = useNavigate();
  const filters = useFilterStore();

  const [trades, setTrades] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef(null);

  const [selected, setSelected] = useState([]);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const loadTrades = useCallback(
    async (page = 1, limit = 25, searchTerm = '') => {
      setLoading(true);
      setError(null);
      try {
        const range = resolveDateRange(
          filters.datePreset,
          filters.customFrom,
          filters.customTo,
        );
        const data = await tradeApi.fetchTrades({
          page,
          limit,
          search: searchTerm || undefined,
          accountId: filters.accountId || undefined,
          symbol: filters.symbol || undefined,
          strategy: filters.strategy || undefined,
          setup: filters.setup || undefined,
          direction: filters.direction || undefined,
          session: filters.session || undefined,
          tags: filters.tags?.length ? filters.tags : undefined,
          dateFrom: range.dateFrom
            ? new Date(range.dateFrom).toISOString()
            : undefined,
          dateTo: range.dateTo
            ? new Date(range.dateTo).toISOString()
            : undefined,
          sortBy: 'entryTime',
          sortDir: 'desc',
        });
        setTrades(data.items);
        setPagination(data.pagination);
        setSelected([]);
      } catch (err) {
        setError(
          err.response?.data?.error?.message ||
            err.message ||
            'Failed to load trades',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      filters.accountId,
      filters.customFrom,
      filters.customTo,
      filters.datePreset,
      filters.direction,
      filters.session,
      filters.setup,
      filters.strategy,
      filters.symbol,
      filters.tags,
    ],
  );

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await tradeApi.fetchAccounts();
      setAccounts(data);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to load accounts',
      );
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadTrades(1, 25, search);
  }, [loadAccounts, loadTrades, search]);

  // Debounce search input -> triggers a fresh server-side query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      loadTrades(1, pagination.limit, searchInput);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    try {
      await tradeApi.createAccount({ name: newAccountName.trim() });
      setNewAccountName('');
      setNewAccountOpen(false);
      loadAccounts();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to create account',
      );
    }
  };

  const openCreateForm = () => {
    setEditingTrade(null);
    setFormOpen(true);
  };

  const openEditForm = (trade) => {
    setEditingTrade(trade);
    setFormOpen(true);
  };

  const handleFormSubmit = async (payload) => {
    try {
      if (editingTrade) {
        await tradeApi.updateTrade(editingTrade._id, payload);
        setToast('Trade updated');
      } else {
        await tradeApi.createTrade(payload);
        setToast('Trade created');
      }
      setFormOpen(false);
      loadTrades(pagination.page, pagination.limit, search);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to save trade',
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await tradeApi.deleteTrade(deleteTarget._id);
      setToast('Trade deleted');
      setDeleteTarget(null);
      loadTrades(pagination.page, pagination.limit, search);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to delete trade',
      );
    }
  };

  const toggleSelectAll = (e) => {
    setSelected(e.target.checked ? trades.map((t) => t._id) : []);
  };

  const toggleSelectOne = (tradeId) => {
    setSelected((prev) =>
      prev.includes(tradeId)
        ? prev.filter((id) => id !== tradeId)
        : [...prev, tradeId],
    );
  };

  const runBulkDelete = async () => {
    try {
      await tradeApi.bulkDeleteTrades(selected);
      setToast(`${selected.length} trade(s) deleted`);
      setBulkDeleteOpen(false);
      loadTrades(pagination.page, pagination.limit, search);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Bulk delete failed',
      );
    }
  };

  const runBulkTag = async () => {
    const tags = bulkTagValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    try {
      await tradeApi.bulkTagTrades(selected, tags);
      setToast(`Tagged ${selected.length} trade(s)`);
      setBulkTagOpen(false);
      setBulkTagValue('');
      loadTrades(pagination.page, pagination.limit, search);
    } catch (err) {
      setError(
        err.response?.data?.error?.message || err.message || 'Bulk tag failed',
      );
    }
  };

  const handleExport = () => {
    const url = tradeApi.exportTradesUrl({ search: search || undefined });
    window.open(url, '_blank');
  };

  const hasAccounts = accounts.length > 0;
  const allOnPageSelected =
    trades.length > 0 && selected.length === trades.length;

  // Keyboard shortcuts: "/" focuses search, "n" opens the new-trade dialog.
  // Both are ignored while typing in any input/textarea, or while another
  // dialog is already open, so they never hijack normal typing.
  useEffect(() => {
    const anyDialogOpen =
      formOpen ||
      !!deleteTarget ||
      bulkTagOpen ||
      bulkDeleteOpen ||
      newAccountOpen;
    const handleKeyDown = (e) => {
      const isTypingTarget =
        ['INPUT', 'TEXTAREA'].includes(e.target.tagName) ||
        e.target.isContentEditable;
      if (isTypingTarget || anyDialogOpen) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' && hasAccounts) {
        e.preventDefault();
        openCreateForm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formOpen,
    deleteTarget,
    bulkTagOpen,
    bulkDeleteOpen,
    newAccountOpen,
    hasAccounts,
  ]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant='h5'>Trades</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant='outlined'
            size='small'
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
          <Button
            variant='outlined'
            size='small'
            onClick={() => setNewAccountOpen(true)}
          >
            New account
          </Button>
          <Tooltip title={hasAccounts ? 'Shortcut: n' : ''}>
            <span>
              <Button
                variant='contained'
                size='small'
                startIcon={<AddIcon />}
                onClick={openCreateForm}
                disabled={!hasAccounts}
              >
                New trade
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity='error' onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {toast && (
        <Alert severity='success' onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast}
        </Alert>
      )}

      {!accountsLoading && !hasAccounts && (
        <Alert severity='info' sx={{ mb: 2 }}>
          Create at least one account before logging trades. Use "New account"
          above.
        </Alert>
      )}

      <TextField
        size='small'
        inputRef={searchInputRef}
        placeholder='Search symbol, setup, tags, notes…  (/)'
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        sx={{ mb: 2, width: 340 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <SearchIcon fontSize='small' />
            </InputAdornment>
          ),
        }}
      />

      <Paper>
        {selected.length > 0 && (
          <Toolbar
            sx={{
              bgcolor: 'rgba(76, 141, 255, 0.08)',
              minHeight: '48px !important',
            }}
          >
            <Typography variant='body2' sx={{ flex: 1 }}>
              {selected.length} selected
            </Typography>
            <Button
              size='small'
              startIcon={<LabelIcon />}
              onClick={() => setBulkTagOpen(true)}
              sx={{ mr: 1 }}
            >
              Add tags
            </Button>
            <Button
              size='small'
              color='error'
              startIcon={<DeleteIcon />}
              onClick={() => setBulkDeleteOpen(true)}
            >
              Delete
            </Button>
          </Toolbar>
        )}
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell padding='checkbox'>
                  <Checkbox
                    indeterminate={
                      selected.length > 0 && selected.length < trades.length
                    }
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Dir</TableCell>
                <TableCell align='right'>Qty</TableCell>
                <TableCell align='right'>Entry</TableCell>
                <TableCell align='right'>Exit</TableCell>
                <TableCell align='right'>Net P&L</TableCell>
                <TableCell align='right'>R</TableCell>
                <TableCell>Setup</TableCell>
                <TableCell>Session</TableCell>
                <TableCell align='right'>Duration</TableCell>
                <TableCell>Tags</TableCell>
                <TableCell align='center'>Plan</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={15} align='center' sx={{ py: 4 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}

              {!loading && trades.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} align='center' sx={{ py: 4 }}>
                    <Typography color='text.secondary' variant='body2'>
                      {search
                        ? 'No trades match your search.'
                        : hasAccounts
                          ? 'No trades yet. Click "New trade" to log your first one.'
                          : 'Create an account first.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                trades.map((t) => (
                  <TableRow
                    key={t._id}
                    hover
                    selected={selected.includes(t._id)}
                    onClick={() => navigate(`/trades/${t._id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell
                      padding='checkbox'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected.includes(t._id)}
                        onChange={() => toggleSelectOne(t._id)}
                      />
                    </TableCell>
                    <TableCell
                      className='mono-data'
                      onClick={() => navigate(`/trades/${t._id}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      {format(new Date(t.entryTime), 'MM/dd/yy HH:mm')}
                    </TableCell>
                    <TableCell
                      sx={{ fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => navigate(`/trades/${t._id}`)}
                    >
                      {t.symbol}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        label={t.direction}
                        color={t.direction === 'long' ? 'success' : 'error'}
                        variant='outlined'
                      />
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      {t.quantity}
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      {t.entryPrice?.toFixed(2)}
                    </TableCell>
                    <TableCell align='right' className='mono-data'>
                      {t.exitPrice !== null && t.exitPrice !== undefined
                        ? t.exitPrice.toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell
                      align='right'
                      className='mono-data'
                      sx={{
                        color:
                          t.netPnL > 0
                            ? 'success.main'
                            : t.netPnL < 0
                              ? 'error.main'
                              : 'text.primary',
                      }}
                    >
                      {formatCurrency(t.netPnL)}
                    </TableCell>
                    <TableCell
                      align='right'
                      className='mono-data'
                      sx={{
                        color:
                          t.rMultiple > 0
                            ? 'success.main'
                            : t.rMultiple < 0
                              ? 'error.main'
                              : 'text.primary',
                      }}
                    >
                      {t.rMultiple !== null && t.rMultiple !== undefined
                        ? `${t.rMultiple.toFixed(2)}R`
                        : '—'}
                    </TableCell>
                    <TableCell>{t.setup || '—'}</TableCell>
                    <TableCell>{t.session}</TableCell>
                    <TableCell align='right' className='mono-data'>
                      {formatDuration(t.holdingTimeSeconds)}
                    </TableCell>
                    <TableCell>
                      {(t.tags || []).slice(0, 3).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size='small'
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell align='center'>
                      {t.followedPlan === true && (
                        <CheckIcon fontSize='small' color='success' />
                      )}
                      {t.followedPlan === false && (
                        <CloseIcon fontSize='small' color='error' />
                      )}
                      {(t.followedPlan === null ||
                        t.followedPlan === undefined) &&
                        '—'}
                    </TableCell>
                    <TableCell
                      align='right'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title='Edit trade'>
                        <IconButton
                          size='small'
                          aria-label='Edit trade'
                          onClick={() => openEditForm(t)}
                        >
                          <EditIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title='Delete trade'>
                        <IconButton
                          size='small'
                          aria-label='Delete trade'
                          onClick={() => setDeleteTarget(t)}
                        >
                          <DeleteIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component='div'
          count={pagination.total}
          page={pagination.page - 1}
          rowsPerPage={pagination.limit}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(e, newPage) =>
            loadTrades(newPage + 1, pagination.limit, search)
          }
          onRowsPerPageChange={(e) =>
            loadTrades(1, parseInt(e.target.value, 10), search)
          }
        />
      </Paper>

      <TradeFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        accounts={accounts}
        initialTrade={editingTrade}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete trade?</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            This permanently deletes the {deleteTarget?.symbol} trade from{' '}
            {deleteTarget ? format(new Date(deleteTarget.entryTime), 'PP') : ''}
            . This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color='error' variant='contained' onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)}>
        <DialogTitle>Delete {selected.length} trades?</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            This permanently deletes the selected trades. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
          <Button color='error' variant='contained' onClick={runBulkDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkTagOpen} onClose={() => setBulkTagOpen(false)}>
        <DialogTitle>Add tags to {selected.length} trades</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label='Tags (comma separated)'
            value={bulkTagValue}
            onChange={(e) => setBulkTagValue(e.target.value)}
            sx={{ mt: 1, minWidth: 320 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkTagOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={runBulkTag}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newAccountOpen} onClose={() => setNewAccountOpen(false)}>
        <DialogTitle>New account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label='Account name'
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            sx={{ mt: 1, minWidth: 320 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewAccountOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleCreateAccount}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
