import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

import * as replayApi from '../../services/replayService';
import * as tradeApi from '../../services/tradeService';
import * as tagApi from '../../services/tagService';
import { palette } from '../../theme/theme';
import PageHeader from '../../components/PageHeader';
import { EmptyState, Panel, ProfitLossValue, RMultiple, SectionHeader, TradeDirection } from '../../components/ui';

const SPEED_OPTIONS = [
  { value: 3000, label: '0.5x' },
  { value: 1500, label: '1x' },
  { value: 750, label: '2x' },
  { value: 300, label: '4x' },
];

export default function ReplayPage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1500);
  const timerRef = useRef(null);

  const [allTags, setAllTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    tagApi.fetchTags().then((t) => setAllTags(t.map((x) => x.name))).catch(() => {});
  }, []);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    setSession(null);
    setIndex(0);
    setPlaying(false);
    try {
      const data = await replayApi.fetchReplaySession(date);
      setSession(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const trades = session?.trades || [];
  const current = trades[index];

  useEffect(() => {
    if (!current) return;
    setNotes(current.notes || '');
    setTags(current.tags || []);
    setSaveMsg(null);
  }, [current?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (playing && trades.length > 0) {
      timerRef.current = setInterval(() => {
        setIndex((i) => {
          if (i >= trades.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, speedMs);
    }
    return () => clearInterval(timerRef.current);
  }, [playing, speedMs, trades.length]);

  const chartData = useMemo(() => {
    if (!current) return [];
    const points = [];
    if (current.executions?.length > 0) {
      for (const f of current.executions) {
        points.push({ time: new Date(f.time).getTime(), price: f.price, label: f.side });
      }
    } else {
      points.push({ time: new Date(current.entryTime).getTime(), price: current.entryPrice, label: 'entry' });
      if (current.exitPrice !== null && current.exitTime) {
        points.push({ time: new Date(current.exitTime).getTime(), price: current.exitPrice, label: 'exit' });
      }
    }
    return points.sort((a, b) => a.time - b.time);
  }, [current]);

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await tradeApi.updateTrade(current._id, { notes, tags });
      setSaveMsg('Saved');
      setSession((s) => ({
        ...s,
        trades: s.trades.map((t) => (t._id === current._id ? { ...t, notes, tags } : t)),
      }));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader eyebrow="Tools" title="Trade Replay" description="Review the sequence of a completed session without changing its recorded market data." />

      <Panel sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          type="date"
          label="Session date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Button variant="contained" size="small" onClick={loadSession} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Load session'}
        </Button>
      </Panel>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {session && trades.length === 0 && <EmptyState title="No trades in this session" description={`No trades were recorded on ${date}.`} />}

      {session && trades.length > 0 && (
        <>
          {!session.marketData.configured && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No market-data provider is connected, so there's no real intraday price chart to show. The chart below
              plots only your actual logged entry/exit/fill prices — the dashed line connecting them does not
              represent real price movement.
            </Alert>
          )}

          <Panel sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Trade {index + 1} of {trades.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  aria-label="Previous trade"
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                >
                  <SkipPreviousIcon />
                </IconButton>
                <IconButton size="small" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
                  {playing ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="Next trade"
                  onClick={() => setIndex((i) => Math.min(trades.length - 1, i + 1))}
                  disabled={index === trades.length - 1}
                >
                  <SkipNextIcon />
                </IconButton>
                <TextField
                  select
                  size="small"
                  SelectProps={{ native: true }}
                  value={speedMs}
                  onChange={(e) => setSpeedMs(Number(e.target.value))}
                  sx={{ width: 90 }}
                >
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </TextField>
              </Box>
            </Box>
            <Slider
              size="small"
              value={index}
              min={0}
              max={Math.max(0, trades.length - 1)}
              step={1}
              onChange={(e, v) => setIndex(v)}
              marks
            />
          </Panel>

          {current && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <Panel sx={{ mb: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Typography variant="h6">{current.symbol}</Typography>
                    <TradeDirection direction={current.direction} />
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(current.entryTime), 'p')}
                      {current.exitTime ? ` → ${format(new Date(current.exitTime), 'p')}` : ' (open)'}
                    </Typography>
                  </Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Net P&L</Typography>
                      <ProfitLossValue value={current.netPnL} />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">R multiple</Typography>
                      <RMultiple value={current.rMultiple} />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Quantity</Typography>
                      <Typography sx={{ fontWeight: 700 }}>{current.quantity}</Typography>
                    </Grid>
                  </Grid>

                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={palette.border} />
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(t) => format(new Date(t), 'HH:mm')}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis dataKey="price" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                      <Tooltip
                        labelFormatter={(t) => format(new Date(t), 'p')}
                        formatter={(v, name, props) => [`$${v}`, props.payload.label]}
                      />
                      {current.stopLoss && <ReferenceLine y={current.stopLoss} stroke={palette.loss} strokeDasharray="4 4" label="Stop" />}
                      {current.takeProfit && <ReferenceLine y={current.takeProfit} stroke={palette.profit} strokeDasharray="4 4" label="Target" />}
                      <Line type="linear" dataKey="price" stroke={palette.accent.main} strokeDasharray="5 5" dot={{ r: 4 }} />
                      <Scatter dataKey="price" fill={palette.accent.main} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <Typography variant="caption" color="text.secondary">
                    Points shown are your real logged entry/exit/fill prices only — the connecting line is a visual
                    aid, not actual intrabar price action.
                  </Typography>
                </Panel>
              </Grid>

              <Grid item xs={12} md={5}>
                <Panel>
                  <SectionHeader title="Annotate this trade" description="Record context without changing execution data." />
                  <TextField
                    label="Notes"
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Autocomplete
                    multiple
                    freeSolo
                    size="small"
                    options={allTags}
                    value={tags}
                    onChange={(e, v) => setTags(v)}
                    renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tag" />}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                    {saveMsg && (
                      <Typography variant="caption" color="success.main">
                        {saveMsg}
                      </Typography>
                    )}
                    <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                      {saving ? <CircularProgress size={16} /> : 'Save'}
                    </Button>
                  </Box>
                </Panel>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}
