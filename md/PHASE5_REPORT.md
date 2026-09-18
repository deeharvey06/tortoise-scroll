# Phase 5 completion report — Replay 2.0

## 1. Implemented

A true completed-bar replay workspace consuming Phase 4 historical candles. It supports candlesticks, play/pause, one-bar and configurable multi-bar steps, four playback speeds, timeline scrubbing, current exchange-local/UTC timestamps, execution overlays, session extrema, optional EMA/VWAP, notes, stop/target/price/trend drawings, saved PNG screenshots, historical reveal and blind decision training. Existing trade-sequence review remains in the Trade review tab.

## 2. Architecture and design

The boundaries are explicit:

- Market data: existing provider → normalizer → cache → `marketDataService`.
- State: server-side pure replay engine and owner-scoped persistence service.
- Playback: serial React-independent `PlaybackController`.
- Presentation: theme-aware SVG chart receiving only server-projected visible data.
- Historical overlays: timestamp-filtered executions and separately gated final comparison.
- Decisions: immutable server-timestamped events in `ReplayRun`, independent of historical trades.

Replay starts before the first completed bar. A candle is revealed at its close, not at its opening timestamp. Only the revealed prefix reaches the browser; indicators, axes, extrema and screenshots use that prefix. Source revisions are pinned. Blind runs cannot seek into unseen bars. Results and original untimestamped annotations require explicit reveal at the end; rewinding filters the projection again. No hypothetical orders, prices, profit or scores are created.

## 3. Files created

- `client/src/pages/Replay/ReplayWorkspace.jsx`
- `client/src/pages/Replay/components/CandlestickChart.jsx`
- `client/src/pages/Replay/TradeReviewPage.jsx` (preserved former Replay page)
- `client/src/replay/PlaybackController.js`
- `client/src/replay/captureChart.js`
- `server/src/models/ReplayRun.js`
- `server/src/routes/replayRunRoutes.js`
- `server/src/services/replay/replayEngine.js`
- `server/src/services/replay/replayService.js`
- `server/src/services/replay/historicalOverlay.js`
- `server/src/services/replay/indicators.js`
- `server/tests/fixtures/replay/helpers.js`
- `server/tests/replayEngine.test.js`
- `server/tests/replayService.test.js`
- `server/tests/replayRoutes.test.js`
- `client/src/replay/PlaybackController.test.js`
- `client/src/pages/Replay/ReplayWorkspace.test.jsx`
- `e2e/tests/replay-workspace.spec.js`
- `md/PHASE5_AUDIT.md`, `md/REPLAY.md`, `md/PHASE5_REPORT.md`

## 4. Files modified

- `client/src/pages/Replay/ReplayPage.jsx`: workspace tabs.
- `client/src/pages/Replay/ReplayPage.test.jsx`: preserved regression coverage now imports TradeReviewPage.
- `client/src/services/replayService.js`: additive run APIs and multipart screenshot upload.
- `server/src/app.js`: authenticated replay-run router.
- `server/src/controllers/backupController.js`: owner-scoped replay backup/restore, including private snapshots.
- `server/scripts/migrateOwnership.js`: register the new owned model.
- `server/src/services/marketData/calendar.js`, `normalizer.js`, `server/src/services/marketDataService.js`: canonical close timestamp and cache schema version.
- `server/src/config/logger.js`: test mode uses direct JSON logging instead of a pretty-print worker, addressing intermittent concurrent test-process shutdown stalls; development and production behavior remain unchanged.
- `server/tests/isolation.test.js`, `marketDataNormalization.test.js`: new model and close-time assertions.
- `e2e/tests/market-data.spec.js`: legacy review regression selects its preserved tab.
- `README.md`: current phase links and legacy review navigation.

## 5. Database/model changes

Additive `ReplayRun` collection with owner and owner/update-time indexes, bounded events/screenshot metadata, source revision and private historical snapshots. No destructive migration, historical trade rewrite, or Backtesting model change. Replay runs participate in existing owner-scoped backups and the ownership registry. Existing data is preserved.

## 6. API changes

Additive authenticated `/api/replay/datasets`, `/runs`, `/runs/:id`, `/runs/:id/control`, `/runs/:id/events`, event removal, and private screenshot upload/read routes. Mutations require optimistic versions; stale writes return 409. Existing Replay session/status and market-data contracts remain; canonical candles gain `endTimestamp`. Full endpoint details are in [REPLAY.md](REPLAY.md).

## 7. Frontend changes

Responsive MUI workspace reusing PageHeader, Panel, EmptyState and theme primitives. Explicit loading, empty, success, warning and error states. Accessible labeled controls and keyboard timeline, manual price entry for horizontal lines, dark/light chart colors. Saved runs can resume/reload. Browser timer binding and multipart screenshot encoding defects found during E2E verification were fixed.

## 8. Tests added/updated

Coverage includes no-future-data perturbation, completed-bar timing, long/short and scaled executions, unknown positions, review/blind reveal, rewinding artifacts, immutable decisions, optimistic conflicts, missing/source-changed ranges, malformed commands, source ownership, USER/ADMIN/ROOT isolation, CSRF/session enforcement, suspended accounts, indicator arithmetic and missing volume, UTC/DST/overnight boundaries, controller speed/pause/error/dispose/end-of-data, component states/themes and the complete browser workflow. Existing Phase 4 calendar/cache/provider tests remain active.

## 9. Test results

- Backend: 310 tests passed; required coverage gates passed (81.69% lines, 89.21% branches, 83.21% functions on the serial coverage run).
- Frontend: 76 tests passed.
- Lint and production build passed, including a final frontend rerun after responsive chart refinements.
- Replay browser workflow passed, including screenshot persistence/access, rewind gating, both themes and mobile width. Mobile chart rendering was visually inspected and adjusted to retain readable labels.
- Full browser regression: 47 tests passed. Standard `npm run ci:verify` passed (lint, all server/client tests, production build).

Verification used Node 22 from the existing temporary supported-node installation. Tests use deterministic artificial fixtures isolated from live catalogs. E2E runs reset only `trading-journal-e2e`.

## 10. Security

Authenticated ownership scopes all run, source, trade, strategy and screenshot access, including ROOT/ADMIN. Client owner IDs, cursor/time fields on decisions, unknown input fields and stale versions are rejected. Existing authentication, session, CSRF, origin and rate-limit middleware remain. Private PNGs have upload/dimension/count limits, fixed owner/run paths and no-store responses; screenshot access is denied after rewinding before capture time. No new external service or credentials.

Blind mode does not prevent an owner intentionally reading their original journal or market-data API. It prevents future information leaking through replay state and presentation. Exposure flags distinguish observations recorded after revisiting/revealing data.

## 11. Performance

Reuse Phase 4 normalized range caching; no duplicate downloads/provider code. Playback serializes commands without overlap. Runs are capped at 5,000 bars, 200 historical trades/5,000 executions, 500 events and ten 1 MiB screenshots. Chart rendering is bounded to 120 bars. Projection/indicator calculation is linear in revealed bars; full-prefix responses favor deterministic simplicity over streaming for this phase.

## 12. Known limitations

Requires a configured, complete owner-specific Phase 4 dataset. Source revisions must remain available; changing files invalidates playback while preserving decisions. Indicators/session extrema use only the selected range, so starting mid-session omits earlier context. EMA is fixed at 20; VWAP needs reported volume. Original setup/strategy/risk annotations have no historical edit timestamps and appear only as disclosed post-review context. Screenshot files and source catalogs require separate filesystem backups. Saved-run selector shows the latest 50; advanced drawing editing, chart zoom/pan and run pagination/archive UI are not included.

## 13. Remaining technical debt

Consider immutable source archives, paginated run management, incremental projections for larger datasets, richer chart navigation and a combined metadata/file backup workflow. Existing Sass legacy API and Mongoose reserved-path warnings remain unrelated to this phase.

## 14. Recommended next phase

Review Replay 2.0 against the user's own licensed historical datasets. Backtesting 2.0 can be considered only after explicit approval. No Backtesting 2.0, AI, live trading or later phase was started.
