import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import PageHeader from '@/components/PageHeader';
import { EmptyState, Panel } from '@/components/ui';
import * as api from '@/services/replayService';
import { PlaybackController } from '@/replay/PlaybackController';
import { captureChart } from '@/replay/captureChart';
import CandlestickChart from '@/pages/Replay/components/CandlestickChart';

const message = (error) =>
  error.response?.data?.error?.message || error.message;
export default function ReplayWorkspace() {
  const [datasets, setDatasets] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogMessage, setCatalogMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('blind');
  const [view, setView] = useState(null);
  const viewRef = useRef(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(1000);
  const [stepCount, setStepCount] = useState(5);
  const [seek, setSeek] = useState(null);
  const [showEMA, setShowEMA] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [reasoning, setReasoning] = useState('');
  const [action, setAction] = useState('Wait');
  const [confidence, setConfidence] = useState(3);
  const [note, setNote] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [lineLabel, setLineLabel] = useState('');
  const [tool, setTool] = useState('none');
  const [anchor, setAnchor] = useState(null);
  const svgRef = useRef(null);
  const stepRef = useRef(null);
  const player = useMemo(
    () =>
      new PlaybackController({
        step: () => stepRef.current(),
        onPlaying: setPlaying,
        onError: (err) => setError(message(err)),
      }),
    []
  );
  useEffect(() => {
    player.activate();
    return () => player.dispose();
  }, [player]);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api.fetchReplayDatasets(), api.listReplayRuns()]).then(
      ([catalog, saved]) => {
        if (!active) return;
        if (catalog.status === 'fulfilled') setDatasets(catalog.value);
        else setCatalogMessage(message(catalog.reason));
        if (saved.status === 'fulfilled') setRuns(saved.value);
        else setError(message(saved.reason));
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, []);
  async function mutate(job) {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await job();
      viewRef.current = result;
      setView(result);
      setSeek(null);
      setAnchor(null);
      return result;
    } catch (err) {
      setError(message(err));
      throw err;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function control(command) {
    return mutate(() =>
      api.controlReplay(viewRef.current.id, {
        ...command,
        version: viewRef.current.version,
      })
    );
  }
  stepRef.current = () => control({ action: 'step', count: 1 });
  function manual(command) {
    player.pause();
    control(command).catch(() => {});
  }
  function saveEvent(event) {
    player.pause();
    return mutate(() =>
      api.addReplayEvent(viewRef.current.id, {
        ...event,
        version: viewRef.current.version,
      })
    ).then((result) => {
      if (result)
        setSuccess('Saved to this replay. Historical trades were not changed.');
      return result;
    });
  }
  function selectDataset(id) {
    setDatasetId(id);
    const item = datasets.find((dataset) => dataset.id === id);
    if (item) {
      setFrom(item.calendar.from);
      setTo(item.calendar.to);
      setName(`${item.symbol} ${item.timeframe} replay`);
    }
  }
  function create() {
    player.pause();
    const item = datasets.find((dataset) => dataset.id === datasetId);
    mutate(() =>
      api.createReplayRun({
        name,
        mode,
        datasetId,
        symbol: item.symbol,
        timeframe: item.timeframe,
        from,
        to,
        session: 'all',
      })
    )
      .then((result) => {
        if (result) {
          setRuns((old) => [
            { _id: result.id, name: result.name, mode: result.mode },
            ...old,
          ]);
          setReasoning('');
          setNote('');
        }
      })
      .catch(() => {});
  }
  const localTime = view
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: view.dataset.timezone,
        dateStyle: 'medium',
        timeStyle: 'long',
      }).format(new Date(view.timestamp))
    : '';
  const locked = busy || playing;
  const decisions =
    view?.events.filter((event) => event.kind === 'decision') || [];

  return (
    <Box>
      <PageHeader
        eyebrow='Review & training'
        title='Market replay'
        description='Read the market one completed bar at a time. Keep your reasoning separate from the historical record.'
      />
      {error && (
        <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity='success' sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {loading ? (
        <Box role='status' sx={{ p: 3 }}>
          <CircularProgress size={22} /> Loading historical datasets…
        </Box>
      ) : (
        <Panel sx={{ p: 2, mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
          >
            <Typography variant='subtitle1' sx={{ fontWeight: 700, flex: 1 }}>
              Start a replay
            </Typography>
            <TextField
              select
              size='small'
              label='Resume saved replay'
              value={
                view?.id && runs.some((run) => run._id === view.id)
                  ? view.id
                  : ''
              }
              disabled={locked}
              sx={{ minWidth: { md: 250 } }}
              onChange={(event) => {
                player.pause();
                mutate(() => api.getReplayRun(event.target.value)).catch(
                  () => {}
                );
              }}
            >
              <MenuItem value=''>Choose a run</MenuItem>
              {runs.map((run) => (
                <MenuItem key={run._id} value={run._id}>
                  {run.name} · {run.mode}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {view && (
            <Button
              disabled={locked}
              onClick={() => {
                player.pause();
                mutate(() => api.getReplayRun(viewRef.current.id)).catch(
                  () => {}
                );
              }}
            >
              Reload replay
            </Button>
          )}
          {catalogMessage && (
            <Alert severity='warning' sx={{ mt: 2 }}>
              {catalogMessage}
            </Alert>
          )}
          {!datasets.length ? (
            <EmptyState
              title='No historical datasets available'
              description='Configure your Phase 4 local market-data catalog to start a true market replay. Recorded trades remain available in Trade review.'
            />
          ) : (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  size='small'
                  label='Historical dataset'
                  value={datasetId}
                  disabled={locked}
                  onChange={(event) => selectDataset(event.target.value)}
                >
                  {datasets.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.symbol} · {item.timeframe} · {item.id}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size='small'
                  label='Replay name'
                  value={name}
                  disabled={locked}
                  onChange={(event) => setName(event.target.value)}
                  inputProps={{ maxLength: 120 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  size='small'
                  label='Replay mode'
                  value={mode}
                  disabled={locked}
                  onChange={(event) => setMode(event.target.value)}
                >
                  <MenuItem value='blind'>Blind training</MenuItem>
                  <MenuItem value='review'>Historical review</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size='small'
                  label='From (ISO timestamp with offset)'
                  value={from}
                  disabled={locked}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  size='small'
                  label='To (exclusive ISO timestamp)'
                  value={to}
                  disabled={locked}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant='contained'
                  disabled={locked || !datasetId || !name.trim()}
                  onClick={create}
                >
                  Start replay
                </Button>
              </Grid>
            </Grid>
          )}
        </Panel>
      )}
      {view && (
        <>
          <Panel sx={{ p: { xs: 1.5, md: 2.5 }, mb: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent='space-between'
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant='h6'>{view.name}</Typography>
                <Typography variant='body2' data-testid='replay-current-time'>
                  {localTime}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {view.timestamp} · {view.dataset.timezone}
                </Typography>
              </Box>
              <Stack direction='row' spacing={1} alignItems='center'>
                <Chip
                  label={
                    view.mode === 'blind'
                      ? 'Blind training'
                      : 'Historical review'
                  }
                  color={view.mode === 'blind' ? 'primary' : 'default'}
                />
                <Chip
                  label={
                    view.complete
                      ? 'End of data'
                      : `Bar ${view.cursor + 1} / ${view.barCount}`
                  }
                />
              </Stack>
            </Stack>
            {view.mode === 'blind' && !view.revealed && (
              <Alert severity='info' sx={{ mb: 1 }}>
                Original trades and results are hidden. Record Long, Short, or
                Wait before revealing more bars.
              </Alert>
            )}
            {view.afterExposure && (
              <Alert severity='warning' sx={{ mb: 1 }}>
                You have already seen later data or revealed the original
                trades. New decisions are marked as made after exposure.
              </Alert>
            )}
            <CandlestickChart
              view={view}
              showEMA={showEMA}
              showVWAP={showVWAP}
              showHistory={showHistory}
              svgRef={svgRef}
              onPoint={
                locked || tool === 'none'
                  ? undefined
                  : (point) => {
                      if (tool === 'trend' && !anchor) {
                        setAnchor(point);
                        return;
                      }
                      const event =
                        tool === 'trend'
                          ? {
                              kind: 'line',
                              lineType: 'trend',
                              price: anchor.price,
                              startCursor: anchor.cursor,
                              endCursor: point.cursor,
                              endPrice: point.price,
                              text: lineLabel,
                            }
                          : {
                              kind: 'line',
                              lineType: tool,
                              price: point.price,
                              text: lineLabel,
                            };
                      saveEvent(event).catch(() => {});
                    }
              }
            />
            <Stack
              direction='row'
              spacing={2}
              useFlexGap
              flexWrap='wrap'
              alignItems='center'
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showEMA}
                    onChange={(event) => setShowEMA(event.target.checked)}
                  />
                }
                label='EMA 20'
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showVWAP}
                    onChange={(event) => setShowVWAP(event.target.checked)}
                  />
                }
                label='Session VWAP'
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showHistory}
                    onChange={(event) => setShowHistory(event.target.checked)}
                    disabled={view.mode === 'blind' && !view.revealed}
                  />
                }
                label='Execution markers'
              />
              <Typography variant='body2'>
                Visible session high: {view.indicators.sessionHigh ?? '—'} ·
                low: {view.indicators.sessionLow ?? '—'}
              </Typography>
            </Stack>
            <Typography variant='caption' color='text.secondary'>
              EMA seeds with the first visible close. VWAP uses typical price ×
              reported volume and resets by trading date. Chart displays the
              latest 120 revealed bars. VWAP and session high/low use only the
              selected range’s revealed bars, including configured extended
              sessions.
            </Typography>
            {showVWAP && view.indicators.vwapUnavailable && (
              <Alert severity='warning' sx={{ mt: 1 }}>
                VWAP unavailable: this trading date has missing volume or no
                positive reported volume.
              </Alert>
            )}
            <Slider
              aria-label='Replay timeline'
              min={-1}
              max={Math.max(
                0,
                view.mode === 'blind' ? view.maxCursor : view.barCount - 1
              )}
              value={seek ?? view.cursor}
              disabled={locked || (view.mode === 'blind' && view.maxCursor < 0)}
              onChange={(_event, value) => setSeek(value)}
              onChangeCommitted={(_event, value) =>
                manual({ action: 'seek', cursor: value })
              }
              getAriaValueText={(value) => `Through bar ${value + 1}`}
              sx={{ mt: 2, width: 'calc(100% - 24px)', ml: 1.5 }}
            />
            <Stack
              direction='row'
              spacing={1}
              useFlexGap
              flexWrap='wrap'
              alignItems='center'
            >
              <Button
                variant='contained'
                startIcon={playing ? <PauseIcon /> : <PlayArrowIcon />}
                disabled={!playing && (busy || view.complete)}
                onClick={() => (playing ? player.pause() : player.play())}
              >
                {playing ? 'Pause' : 'Play'}
              </Button>
              <Button
                startIcon={<SkipNextIcon />}
                disabled={locked || view.complete}
                onClick={() => manual({ action: 'step', count: 1 })}
              >
                Step one bar
              </Button>
              <TextField
                select
                size='small'
                label='Step size'
                value={stepCount}
                onChange={(event) => setStepCount(Number(event.target.value))}
                sx={{ minWidth: 95 }}
              >
                {[1, 5, 10, 25, 100].map((count) => (
                  <MenuItem key={count} value={count}>
                    {count} bars
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={locked || view.complete}
                onClick={() => manual({ action: 'step', count: stepCount })}
              >
                Advance {stepCount}
              </Button>
              <TextField
                select
                size='small'
                label='Playback speed'
                value={delay}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDelay(value);
                  player.setSpeed(value);
                }}
                sx={{ minWidth: 120 }}
              >
                {[
                  [2000, '0.5×'],
                  [1000, '1×'],
                  [500, '2×'],
                  [250, '4×'],
                ].map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                disabled={locked || !view.complete || view.revealed}
                onClick={() => manual({ action: 'reveal' })}
              >
                Reveal original trades
              </Button>
              <Button
                startIcon={<PhotoCameraOutlinedIcon />}
                disabled={locked || view.cursor < 0}
                onClick={() => {
                  player.pause();
                  mutate(async () =>
                    api.saveReplayScreenshot(
                      viewRef.current.id,
                      await captureChart(svgRef.current),
                      viewRef.current.version
                    )
                  )
                    .then(() => setSuccess('Chart screenshot saved.'))
                    .catch(() => {});
                }}
              >
                Save chart screenshot
              </Button>
              {busy && (
                <CircularProgress size={18} aria-label='Updating replay' />
              )}
            </Stack>
          </Panel>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={5}>
              <Panel sx={{ p: 2, height: '100%' }}>
                <Typography variant='h6' sx={{ mb: 2 }}>
                  Decision journal
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ mb: 2 }}
                >
                  An observation, not a simulated order. Decisions are saved at
                  the current replay timestamp and cannot be edited afterward.
                </Typography>
                <Stack direction='row' spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    select
                    label='Decision'
                    value={action}
                    onChange={(event) => setAction(event.target.value)}
                    fullWidth
                    size='small'
                  >
                    {['Long', 'Short', 'Wait'].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label='Confidence'
                    value={confidence}
                    onChange={(event) =>
                      setConfidence(Number(event.target.value))
                    }
                    fullWidth
                    size='small'
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value} / 5
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label='Reasoning'
                  value={reasoning}
                  onChange={(event) => setReasoning(event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                />
                <Button
                  variant='outlined'
                  sx={{ mt: 1 }}
                  disabled={locked || !reasoning.trim()}
                  onClick={() =>
                    saveEvent({
                      kind: 'decision',
                      action,
                      confidence,
                      text: reasoning,
                    })
                      .then((result) => {
                        if (result) setReasoning('');
                      })
                      .catch(() => {})
                  }
                >
                  Record decision
                </Button>
                {!decisions.length && (
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    sx={{ mt: 2 }}
                  >
                    No decisions at or before this timestamp.
                  </Typography>
                )}
                {decisions.map((event) => (
                  <Box
                    key={event._id}
                    sx={{ borderTop: 1, borderColor: 'divider', mt: 2, pt: 1 }}
                  >
                    <Typography fontWeight={700}>
                      {event.action} · {event.confidence}/5{' '}
                      {event.afterExposure ? '· after exposure' : ''}
                    </Typography>
                    <Typography variant='caption'>{event.timestamp}</Typography>
                    <Typography
                      sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {event.text}
                    </Typography>
                  </Box>
                ))}
              </Panel>
            </Grid>
            <Grid item xs={12} lg={7}>
              <Panel sx={{ p: 2 }}>
                <Typography variant='h6' sx={{ mb: 2 }}>
                  Notes & chart annotations
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label='Replay note / strategy / setup'
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                />
                <Button
                  sx={{ my: 1 }}
                  disabled={locked || !note.trim()}
                  onClick={() =>
                    saveEvent({ kind: 'note', text: note })
                      .then((result) => {
                        if (result) setNote('');
                      })
                      .catch(() => {})
                  }
                >
                  Save replay note
                </Button>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <TextField
                    select
                    size='small'
                    label='Drawing tool'
                    value={tool}
                    onChange={(event) => {
                      setTool(event.target.value);
                      setAnchor(null);
                    }}
                    sx={{ minWidth: 140 }}
                  >
                    {[
                      ['none', 'Select'],
                      ['level', 'Price level'],
                      ['stop', 'Stop line'],
                      ['target', 'Target line'],
                      ['trend', 'Trend line'],
                    ].map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size='small'
                    label='Annotation label'
                    value={lineLabel}
                    onChange={(event) => setLineLabel(event.target.value)}
                    inputProps={{ maxLength: 200 }}
                    fullWidth
                  />
                  <TextField
                    size='small'
                    label='Line price'
                    type='number'
                    value={linePrice}
                    onChange={(event) => setLinePrice(event.target.value)}
                    inputProps={{ step: 'any' }}
                  />
                </Stack>
                <Typography
                  variant='caption'
                  display='block'
                  color='text.secondary'
                >
                  {tool === 'trend'
                    ? anchor
                      ? 'Select the second revealed point.'
                      : 'Select two revealed chart points to draw a trend line.'
                    : 'Click the chart to place the selected line, or enter a price below. Lines and notes are known only from the time you create them.'}
                </Typography>
                <Button
                  disabled={
                    locked ||
                    view.cursor < 0 ||
                    !['level', 'stop', 'target'].includes(tool) ||
                    linePrice.trim() === '' ||
                    !Number.isFinite(Number(linePrice))
                  }
                  onClick={() =>
                    saveEvent({
                      kind: 'line',
                      lineType: tool,
                      price: Number(linePrice),
                      text: lineLabel,
                    }).catch(() => {})
                  }
                >
                  Add line at price
                </Button>
                {view.events
                  .filter((event) => event.kind !== 'decision')
                  .map((event) => (
                    <Stack
                      key={event._id}
                      direction='row'
                      spacing={1}
                      justifyContent='space-between'
                      sx={{
                        borderTop: 1,
                        borderColor: 'divider',
                        pt: 1,
                        mt: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {event.kind === 'line'
                            ? `${event.lineType} @ ${event.price}: `
                            : ''}
                          {event.text}
                        </Typography>
                        <Typography variant='caption'>
                          {event.timestamp}
                        </Typography>
                      </Box>
                      <Button
                        size='small'
                        disabled={locked}
                        onClick={() => {
                          player.pause();
                          mutate(() =>
                            api.removeReplayEvent(
                              viewRef.current.id,
                              event._id,
                              viewRef.current.version
                            )
                          ).catch(() => {});
                        }}
                      >
                        Remove
                      </Button>
                    </Stack>
                  ))}
                {view.screenshots.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant='subtitle2'>
                      Saved chart screenshots
                    </Typography>
                    <Stack direction='row' useFlexGap flexWrap='wrap' gap={1}>
                      {view.screenshots.map((shot) => (
                        <Box
                          key={shot.id}
                          component='a'
                          href={shot.url}
                          target='_blank'
                          rel='noreferrer'
                          sx={{ width: 180 }}
                        >
                          <Box
                            component='img'
                            src={`${shot.url}?v=${view.version}`}
                            alt={`Replay chart at ${shot.timestamp}`}
                            sx={{ width: '100%', borderRadius: 1 }}
                          />
                          <Typography variant='caption'>
                            {shot.timestamp}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Panel>
            </Grid>
          </Grid>
          {view.comparison !== null && (
            <Panel sx={{ p: 2, mt: 2 }}>
              <Typography variant='h6'>Historical comparison</Typography>
              <Alert severity='info' sx={{ my: 1 }}>
                Original setup, strategy, risk levels and notes are post-review
                context: their historical edit times are unknown. Results are
                shown only for trades closed by the replay timestamp. No
                hypothetical P&L or decision score is invented.
              </Alert>
              {!view.comparison.length && (
                <Typography>No historical trades in this range.</Typography>
              )}
              {view.comparison.map((trade) => (
                <Box
                  key={trade.id}
                  sx={{ borderTop: 1, borderColor: 'divider', py: 1 }}
                >
                  <Typography fontWeight={700}>
                    {trade.direction} · {trade.setup || 'No setup'} ·{' '}
                    {trade.strategy || 'No strategy'}
                  </Typography>
                  <Typography>
                    Recorded net P&L:{' '}
                    {trade.resultAvailable
                      ? (trade.netPnL ?? 'unavailable')
                      : 'not yet closed'}{' '}
                    · stop: {trade.stopLoss ?? '—'} · target:{' '}
                    {trade.takeProfit ?? '—'}
                  </Typography>
                  <Typography
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {trade.notes}
                  </Typography>
                </Box>
              ))}
            </Panel>
          )}
        </>
      )}
    </Box>
  );
}
