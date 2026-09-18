# Market replay (Phase 5)

Open **Replay → Market replay**. The **Trade review** tab retains the existing trade-sequence review and historical annotations.

## Historical data

Configure the existing [Phase 4 local catalog](MARKET_DATA.md) for the authenticated user. Choose a dataset, a name, a mode, and an explicit ISO timestamp range (UTC `Z` or an offset). No cloud provider is required. Replay calls the existing market-data service and cache; it neither downloads nor synthesizes candles itself.

The range must contain complete, available bars, up to 5,000. Missing bars, invalid source files, partial final candles, or changed source revisions produce explicit errors. Correct the source or select another range. Existing decisions are retained when a source changes; start a new run against the changed source.

## Playback and time

A run starts with no candles. Step one bar, advance a selected number of bars, or play at 0.5×–4×. Playback pauses on errors and at end of data. Speed is a delay between completed requests, not a promise of wall-clock synchronization. An in-flight step may finish after Pause; no further step is scheduled.

The current timestamp is the close of the latest completed candle. Canonical `timestamp` remains the bar opening timestamp; additive `endTimestamp` is the close derived by Phase 4 from the timeframe and declared session windows. Short session-ending bars and daily bars use their actual session end. UTC controls calculations; chart labels use the dataset's exchange timezone. DST, overnight sessions, holidays, and gaps use the declared Phase 4 calendar.

The server returns only the revealed candle prefix. Indicators, price axes, tooltips, session extrema, markers, and chart screenshots use that prefix. The chart displays its latest 120 bars; scrub backward to inspect earlier bars. In review mode, the timeline can jump anywhere in the chosen range. In blind mode it can revisit only previously revealed bars; advance with Step or Play.

## Review, training, and annotations

Review mode displays timestamp-eligible entry, scale-in, scale-out, and exit executions. Manual trades without fills use their recorded entry/exit events. Unmatched reducing fills remain labeled executions instead of inventing a position.

Blind mode hides historical executions and results until the range finishes and **Reveal original trades** is selected. Original setup, strategy, notes, stop/target and results appear in the final comparison; these historical annotations lack edit-time provenance and are explicitly post-review context. Trades still open at the final timestamp do not expose eventual results. Rewinding hides later candles, executions, annotations, screenshots and the comparison again.

Record **Long**, **Short**, or **Wait**, confidence 1–5 and reasoning. Decisions are immutable, timestamped at the server's current cursor, and stored separately from trades. Decisions after rewinding or revealing are labeled **after exposure**. These are observations, not simulated orders; no execution, hypothetical profit or training score is invented. Blind mode is a training workflow, not an anti-cheating boundary against the account owner accessing their existing journal or historical-data API.

Save replay notes, strategy/setup observations, stop lines, target lines and price levels. Use the chart to place lines or enter a price. Trend lines use two revealed points. Notes and drawings can be removed; decisions cannot. Up to 500 events and ten PNG chart screenshots are retained per run. Screenshots show the visible chart, not the entire journal, and are served only to the owner when their saved cursor is visible.

EMA 20 uses the first visible close as its seed. VWAP uses `(high + low + close) / 3`, weighted by reported volume, and resets by trading date. Both use Decimal arithmetic on the server. Missing volume invalidates that date's VWAP; zero cumulative volume yields unavailable. Session high/low refer to revealed bars of the current trading date, including configured extended-session bars. These values are range-relative when replay starts partway through a trading date.

## Persistence and APIs

`ReplayRun` stores the owner, range/revision, historical trade snapshot, cursor, version, decisions, notes, drawings and screenshot metadata. Historical trades are never edited by these APIs. Run creation limits historical overlays to 200 trades / 5,000 executions; narrow the range if necessary. The saved-run selector shows the latest 50 runs.

Authenticated endpoints under `/api/replay`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/datasets` | Existing Phase 4 owner catalog |
| GET / POST | `/runs` | List / create owned runs |
| GET | `/runs/:id` | Current server-filtered state |
| POST | `/runs/:id/control` | `step`, `seek`, or `reveal` with `version` |
| POST | `/runs/:id/events` | Decision, note or drawing with `version` |
| DELETE | `/runs/:id/events/:eventId` | Remove visible non-decision event with `version` |
| POST | `/runs/:id/screenshots` | Multipart PNG `file`, `version`, optional `caption` |
| GET | `/runs/:id/screenshots/:shotId` | Owner- and cursor-gated PNG |

Existing session, CSRF, origin and rate-limit middleware apply. Every database operation uses the authenticated owner; ADMIN/ROOT do not bypass private-run ownership. Mutation versions provide atomic conflict detection across tabs. Use **Reload replay** after a conflict. Responses and screenshot requests use `Cache-Control: no-store`.

No destructive database migration is required. Backup export/restore includes replay runs and private snapshots. As with existing screenshot backups, copy the `server/uploads` directory separately; replay PNGs live under `uploads/replay/<owner>/<run>/`. The source market-data catalog is also an external file dependency and must be backed up separately. Restoring metadata alone does not restore either file set.

## Scope and follow-up

No Replay order simulator, Backtesting 2.0, vendor integration, live quotes, AI, or fabricated bars were added. Potential future work includes paginated run management, immutable source archives, richer chart navigation, and archive/export tooling, after explicit approval.
