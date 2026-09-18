# Phase 4 — Real Market Data Infrastructure

## 1. What was implemented

A real local CSV provider now feeds the existing market-data abstraction through strict timestamp/calendar/candle normalization and a bounded cache. Authenticated APIs expose owned datasets, canonical historical candles, integrity diagnostics, and explicit availability states. No production market prices or synthetic fallback data are bundled.

Pre-implementation findings: [Phase 4 audit](PHASE4_AUDIT.md). Setup and full contract: [Market data guide](MARKET_DATA.md).

## 2. Architecture/design decisions

- Adapter → common normalizer → canonical source cache → range selection → consumers. Vendor-specific source handling belongs in adapters.
- `MarketDataProvider` covers symbols, timestamps, calendars, session hours, contract metadata, catalog/description, and raw candle fetching.
- Local manifests are server-managed and user scoped; no client-selected paths or upload workflow.
- Reuse Phase 3's owner-scoped instrument specification resolver. No duplicate financial metadata store.
- UTC bar-start timestamps; explicit source IANA timezone and timestamp convention. Temporal rejects ambiguous/nonexistent local DST times.
- Finite, explicit calendar coverage with non-overlapping session intervals. No guessed holidays, futures rolls, resampling, price adjustments, or missing bars.
- Preserve legacy `fetchCandles()` and `time` aliases. Existing Backtesting requires a complete non-empty range and confirmed multiplier 1 because its engine does not apply contract multipliers. Canonical consumers can retrieve futures/options data and metadata independently.

## 3. Files created

- `server/src/services/marketData/MarketDataProvider.js`
- `server/src/services/marketData/LocalCsvProvider.js`
- `server/src/services/marketData/CandleCache.js`
- `server/src/services/marketData/calendar.js`
- `server/src/services/marketData/time.js`
- `server/src/services/marketData/normalizer.js`
- `server/src/services/marketData/errors.js`
- `server/src/routes/marketDataRoutes.js`
- `server/tests/marketDataNormalization.test.js`
- `server/tests/marketDataService.test.js`
- `server/tests/marketDataRoutes.test.js`
- `server/tests/fixtures/market-data/candles.csv`
- `server/tests/fixtures/market-data/helpers.js`
- `client/src/pages/Replay/ReplayPage.test.jsx`
- `e2e/tests/market-data.spec.js`
- `md/PHASE4_AUDIT.md`, `md/MARKET_DATA.md`, `md/PHASE4_REPORT.md`

## 4. Files modified

- `server/src/services/marketDataService.js`: replace stub with service contract, local provider selection, normalization/cache, typed states and strict legacy wrapper.
- `server/src/app.js`: mount the protected market-data router; support test service injection.
- `server/src/controllers/backtestController.js`: pass authenticated ownership and explicit unit-multiplier precondition.
- `server/src/controllers/replayController.js`: prevent query parameters overriding authenticated ownership.
- `server/package.json`, `server/package-lock.json`: pin `@js-temporal/polyfill` 0.5.1.
- `client/src/pages/Replay/ReplayPage.jsx`: keep the recorded-fill chart disclosure visible when market data is configured.
- `e2e/playwright.config.js`: enable the local provider only for the isolated E2E server and fixture catalog.
- `.gitignore`: ignore the E2E catalog.
- `README.md`: link the current setup/contract and correct obsolete market-data instructions.

## 5. Database/model changes

None. Existing MongoDB documents, indexes, authentication/session records, user roles, and saved BacktestConfig records are preserved. No migration is required. Historical CSVs and manifests remain operator-managed files outside MongoDB; back them up separately.

## 6. API changes

Additive authenticated GET endpoints:

- `/api/market-data/status`
- `/api/market-data/datasets`
- `/api/market-data/candles`

The candle response includes canonical candles, source identity/revision/context, current contract metadata, and diagnostics. Availability is `available`, `partial`, `unavailable`, `closed`, or `empty`; invalid/unavailable selections return safe typed errors. HTTP responses prohibit shared caching.

Existing Replay/Backtesting endpoint shapes remain. Backtesting cannot run incomplete data or instruments whose known contract multiplier is incompatible with its unchanged engine. Saved results are not overwritten on rejected runs. Replay query ownership is corrected as a security regression discovered during the required dependency audit.

## 7. Frontend changes

Only Replay's existing informational disclosure changed. The chart continues to display real recorded fills, not historical candles, even with a configured provider. Existing responsive layout, light/dark themes, loading/error/empty states, annotation controls, and navigation remain. There is no new market-data upload workflow or replay interface in this infrastructure phase.

## 8. Tests added/updated

90 backend tests added across normalization, service/cache/provider, and real Express authentication/authorization integration suites. Coverage includes:

- UTC offsets, explicit local timestamps, spring DST gaps, autumn folds, malformed dates and forbidden implicit timestamps.
- OHLC bounds, numeric validity, negative prices, absent/zero volume, conflicting/identical duplicates and sorting.
- Premarket/RTH/postmarket filtering, overnight futures dates, daily session grouping, early closes, explicit closed periods, leading/middle/trailing gaps and open-session empty ranges.
- Cache hits, overlapping ranges, concurrency coalescing/limits, TTL, LRU/byte eviction, cloning, error recovery and source/manifest invalidation.
- Unsupported symbols/timeframes/ranges, ambiguous datasets, malformed/oversized CSVs/manifests, traversal/symlink escapes, file changes, sanitized provider failures and a second test adapter.
- Authenticated ownership, USER/ADMIN/ROOT isolation, suspension/session revocation, CSRF preservation, Replay userId override regression and Backtesting compatibility/safety guards.

Five frontend component tests verify Replay disclosure in both themes with/without a provider, plus existing error/empty behavior. One Playwright scenario exercises a real local fixture via authenticated APIs, repeatability, isolation, file invalidation, incomplete/malformed data, and Replay disclosure.

Fixtures contain artificial values solely for deterministic tests; they are never provisioned into production catalogs.

## 9. Test results

Verified with Node 22.23.2 on macOS:

- Backend: **275 passed, 0 failed, 0 skipped**.
- Frontend: **65 passed across 16 files**.
- Playwright Chromium: **46 passed**.
- Existing API smoke: **22 checks passed** against the isolated E2E server.
- Server/client ESLint: **PASS**.
- Production client build: **PASS**.
- Backend coverage: **80.10% lines, 88.33% branches, 81.71% functions**. Existing thresholds remain unchanged.
- `git diff --check`: **PASS**.

## 10. Security considerations

Authentication, role protections, CSRF, session checks, existing rate limits and Mongo ownership rules remain in force. User identity is derived from the session, never API query/body ownership fields. Catalog and cache keys are user scoped without ADMIN/ROOT bypass. Realpath checks and file identity/version checks prevent source escapes and detect changes. Bounded source files, rows, calendars, cache entries/bytes, and concurrent loads limit resource use. Raw provider failures are sanitized. CSVs are parsed as data, never executed. No vendor secrets or local file paths are returned.

## 11. Performance considerations

Normalized sources are cached so repeated and overlapping requests avoid rereading/parsing CSVs. Stat/manifest validation still occurs per request, and contract metadata resolves afresh to honor updated user specifications. Range selection and defensive cloning are linear in the bounded dataset size. Defaults: 32 cached entries/32 MiB, five-minute TTL, four simultaneous source loads, 100,000 bars, 16 MiB CSV, 1 MiB manifest. Cache is per process, not persistent or distributed.

## 12. Known limitations

- Local CSV only; no cloud vendor, network downloader, upload UI or automatic exchange calendar feed.
- Operators must supply authoritative calendars, timestamps, symbols, price basis and actual source prices. Uncovered calendar dates fail explicitly.
- No implicit resampling, adjustments, contract rolling, inferred session schedules, or fabricated gaps.
- Millisecond timestamp precision and fixed supported timeframes. Daily source bars use the declared first-session-open convention.
- Files larger than configured bounds need partitioning; multiple datasets require explicit selection. Current saved Backtesting configurations select symbol/timeframe only and cannot resolve an ambiguous catalog automatically.
- Existing SMA engine behavior is unchanged; unsupported contract multipliers are rejected. Replay remains a recorded-trade review page.
- Local files are outside Mongo backup/restore. Node/ICU timezone database versions affect local-time interpretation across deployments.

## 13. Remaining technical debt

Future phases may add vendor adapters with authoritative calendars, indexed/persistent historical storage, distributed caching, richer dataset selection, and explicit adjustment/roll policies. Those need separate requirements and tests. The original Backtesting engine's simulation and fill assumptions should be reviewed in its own approved phase; they were not rewritten here.

## 14. Recommended next phase

Replay 2.0 may consume the canonical service after explicit approval of its UI and playback requirements. Backtesting 2.0 needs separate approval for simulation/fill rules, contract multipliers, and dataset selection. Neither is started. Tortoise AI remains out of scope. Phase 4 stops here.
