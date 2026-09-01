import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import FilterListIcon from '@mui/icons-material/FilterListOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';

import useFilterStore, { DATE_PRESETS } from '../store/useFilterStore';
import * as tradeApi from '../services/tradeService';
import Tag from './ui/Tag';

const PRESET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  thisMonth: 'This month',
  previousMonth: 'Previous month',
  quarter: 'This quarter',
  year: 'This year',
  allTime: 'All time',
  custom: 'Custom range',
};

const DIRECTIONS = ['long', 'short'];
const SESSIONS = ['pre-market', 'open', 'mid-day', 'power-hour', 'after-hours', 'unspecified'];

export default function GlobalFilterBar({ compact = false }) {
  const filters = useFilterStore();
  const [anchorEl, setAnchorEl] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    tradeApi.fetchAccounts().then(setAccounts).catch(() => {});
  }, []);

  const activeCount = [
    filters.accountId,
    filters.symbol,
    filters.strategy,
    filters.setup,
    filters.direction,
    filters.session,
    filters.tags?.length ? 'tags' : '',
  ].filter(Boolean).length;

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
      <TextField
        select
        size="small"
        value={filters.datePreset}
        onChange={(e) => filters.setDatePreset(e.target.value)}
        inputProps={{ 'aria-label': 'Date range' }}
        sx={{ minWidth: compact ? 132 : 150 }}
      >
        {DATE_PRESETS.map((p) => (
          <MenuItem key={p} value={p}>
            {PRESET_LABELS[p]}
          </MenuItem>
        ))}
      </TextField>

      {filters.datePreset === 'custom' && !compact && (
        <>
          <TextField
            type="date"
            size="small"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={filters.customFrom || ''}
            onChange={(e) => filters.setCustomRange(e.target.value, filters.customTo)}
            sx={{ width: 150 }}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={filters.customTo || ''}
            onChange={(e) => filters.setCustomRange(filters.customFrom, e.target.value)}
            sx={{ width: 150 }}
          />
        </>
      )}

      <Button
        size="small"
        variant={activeCount > 0 ? 'contained' : 'outlined'}
        startIcon={<FilterListIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </Button>

      {activeCount > 0 && !compact && (
        <Button size="small" color="inherit" onClick={filters.reset} startIcon={<CloseIcon fontSize="small" />}>
          Clear
        </Button>
      )}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack spacing={3} sx={{ p: 4, width: compact ? 'min(320px, calc(100vw - 32px))' : 280 }}>
          {compact && filters.datePreset === 'custom' && (
            <Stack direction="row" spacing={2}>
              <TextField
                type="date" size="small" label="From" InputLabelProps={{ shrink: true }}
                value={filters.customFrom || ''}
                onChange={(e) => filters.setCustomRange(e.target.value, filters.customTo)}
                fullWidth
              />
              <TextField
                type="date" size="small" label="To" InputLabelProps={{ shrink: true }}
                value={filters.customTo || ''}
                onChange={(e) => filters.setCustomRange(filters.customFrom, e.target.value)}
                fullWidth
              />
            </Stack>
          )}
          <TextField
            select
            size="small"
            label="Account"
            value={filters.accountId}
            onChange={(e) => filters.setAccountId(e.target.value)}
          >
            <MenuItem value="">All accounts</MenuItem>
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Symbol"
            value={filters.symbol}
            onChange={(e) => filters.setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
          />

          <TextField size="small" label="Setup" value={filters.setup} onChange={(e) => filters.setSetup(e.target.value)} />

          <TextField
            select
            size="small"
            label="Direction"
            value={filters.direction}
            onChange={(e) => filters.setDirection(e.target.value)}
          >
            <MenuItem value="">Both</MenuItem>
            {DIRECTIONS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Session"
            value={filters.session}
            onChange={(e) => filters.setSession(e.target.value)}
          >
            <MenuItem value="">All sessions</MenuItem>
            {SESSIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>

          {compact && activeCount > 0 && (
            <Button size="small" color="inherit" onClick={() => { filters.reset(); setAnchorEl(null); }} startIcon={<CloseIcon fontSize="small" />}>
              Clear filters
            </Button>
          )}
        </Stack>
      </Popover>

      {activeCount > 0 && !compact && (
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {filters.accountId && <Tag label={accounts.find((a) => a._id === filters.accountId)?.name || 'account'} onDelete={() => filters.setAccountId('')} />}
          {filters.symbol && <Tag label={filters.symbol} onDelete={() => filters.setSymbol('')} />}
          {filters.setup && <Tag label={filters.setup} onDelete={() => filters.setSetup('')} />}
          {filters.direction && <Tag label={filters.direction} onDelete={() => filters.setDirection('')} />}
          {filters.session && <Tag label={filters.session} onDelete={() => filters.setSession('')} />}
        </Stack>
      )}
    </Box>
  );
}
