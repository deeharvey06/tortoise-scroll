import { computeIndicators } from './indicators.js';
import {
  historicalMarkers,
  historicalComparison,
} from './historicalOverlay.js';

export class ReplayError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
export function replayTime(run, candles) {
  return run.cursor < 0
    ? run.marketRequest.from
    : candles[run.cursor].endTimestamp;
}
export function transition(run, input) {
  let cursor = run.cursor;
  let revealed = run.revealed;
  if (input.action === 'step')
    cursor = Math.min(run.barCount - 1, cursor + input.count);
  else if (input.action === 'seek') {
    if (
      input.cursor < -1 ||
      input.cursor >= run.barCount ||
      (run.mode === 'blind' && input.cursor > run.maxCursor)
    )
      throw new ReplayError(
        'REPLAY_INVALID_SEEK',
        'Blind runs can scrub only previously revealed bars; use Step or Play to advance.',
        400
      );
    cursor = input.cursor;
  } else if (input.action === 'reveal') {
    if (cursor !== run.barCount - 1)
      throw new ReplayError(
        'REPLAY_NOT_FINISHED',
        'Finish the historical range before revealing original trades.'
      );
    revealed = true;
  }
  return { cursor, maxCursor: Math.max(run.maxCursor, cursor), revealed };
}
export function projectReplay(run, candles) {
  const visible = candles.slice(0, run.cursor + 1);
  const timestamp = replayTime(run, candles);
  const complete = run.cursor === run.barCount - 1;
  const historyVisible = run.mode === 'review' || run.revealed;
  const events = run.events.filter((event) => event.cursor <= run.cursor);
  return {
    id: String(run._id),
    name: run.name,
    mode: run.mode,
    cursor: run.cursor,
    maxCursor: run.maxCursor,
    version: run.version,
    barCount: run.barCount,
    complete,
    revealed: run.revealed,
    timestamp,
    marketRequest: run.marketRequest,
    dataset: run.dataset,
    candles: visible,
    indicators: computeIndicators(visible),
    markers: historyVisible
      ? historicalMarkers(
          run.historicalTrades,
          timestamp,
          run.marketRequest.from
        )
      : [],
    comparison:
      complete && run.revealed
        ? historicalComparison(run.historicalTrades, timestamp)
        : null,
    events,
    screenshots: run.screenshots
      .filter((shot) => shot.cursor <= run.cursor)
      .map((shot) => ({
        ...shot,
        url: `/api/replay/runs/${run._id}/screenshots/${shot.id}`,
      })),
    afterExposure: run.revealed || run.cursor < run.maxCursor,
  };
}
