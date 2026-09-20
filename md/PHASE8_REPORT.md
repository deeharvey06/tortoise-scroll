# Phase 8 — Analytics scalability

## 1. Implemented

Added parallel MongoDB aggregation implementations, an exact streaming compatibility reducer, automated financial parity gates, a compact summary API, and reproducible 100,000-trade benchmarks. Dashboard, calendar, performance reports, market reports, and Strategy/Playbook performance no longer retain the full projected Trade result set before calculation.

This is a staged migration. It does **not** claim that all analytics are now Mongo-only or that the existing 100,000-point dashboard is inexpensive. Financial results, response fields, UTC conventions, filtering, ordering, and existing rounding behavior take priority over eliminating every compatibility calculation.

## 2. Architecture and decisions

The pre-implementation audit is in `PHASE8_AUDIT.md`. New services live under `server/src/services/analytics/`:

- `aggregation.js`: owner-scoped, Mongoose-cast `$match`, Decimal128 accumulation from decimal strings, grouping, projection, sorting, and compact result conversion. Candidates cover summary, P&L/R distributions, daily/calendar, symbol, strategy, setup, session, direction, weekday, and hour. High-cardinality grouping uses cursors rather than a single oversized facet document.
- `streaming.js`: incremental Decimal.js and ordered JavaScript reductions over a 512-record cursor. It retains group/day state and narrow equity inputs rather than entire Trade documents. It reuses existing equity/drawdown functions for the full dashboard; summary-only calls calculate identical maximum drawdown without allocating chart output arrays.
- `scalable.js`: production orchestration and exact candidate adoption. An aggregation result is used only when deeply equal to the reference-compatible value. Rounding differences, order differences, and differences between sequential reads retain the compatibility result. Internal diagnostics identify adoption/fallback; they are not client-controlled.

Legacy deterministic functions and a callable legacy dashboard remain available as reference implementations. Tests compare complete DTOs, without tolerances, rounding away discrepancies, or discarding duplicate strategy rows.

### Production rollout

| Path | Production implementation |
| --- | --- |
| Dashboard KPIs and distributions | Compact Mongo candidate plus exact runtime parity gate |
| Dashboard equity/drawdown | Narrow cursor input; unchanged per-trade financial sequence and output |
| Calendar | Streaming exact daily reduction |
| Symbol/setup/session/direction/weekday/hour/strategy breakdowns | Streaming exact groups |
| Performance report and Strategy/Playbook performance | Compact summary mode, without chart payload allocation |
| Market report | Streaming group-only mode, without chart payload allocation |
| Behavior/execution reports, Risk, methodology analytics | Existing reference paths retained |

Full grouped Mongo candidates remain available for tests and profiling, not enabled indiscriminately in production. Measurements showed that executing all grouped pipelines plus the parity pass roughly doubled dashboard time. Daily R uses ordered JavaScript floating-point addition, whereas Mongo summation can produce different last bits. Strategy grouping currently uses ObjectId object identity, so equal persisted strategy IDs can produce separate rows. A Mongo value-based grouping would change results. Neither behavior was silently corrected.

## 3. Files created

- `server/src/services/analytics/aggregation.js`
- `server/src/services/analytics/streaming.js`
- `server/src/services/analytics/scalable.js`
- `server/tests/analyticsStreaming.test.js`
- `server/tests/integration/analyticsParity.test.js`
- `server/tests/fixtures/analytics/generated.js`
- `server/tests/fixtures/analytics/reference.js`
- `server/scripts/benchmarkAnalytics.js`
- `e2e/tests/analytics-scalability.spec.js`
- `md/PHASE8_AUDIT.md`, `md/PHASE8_REPORT.md`, `md/PHASE8_BENCHMARK.json`

## 4. Files modified

- `server/src/services/analyticsService.js`
- `server/src/services/performanceService.js`
- `server/src/controllers/analyticsController.js`
- `server/src/controllers/reportsController.js`
- `server/src/routes/analyticsRoutes.js`
- `server/package.json` — integration-test and benchmark commands only

## 5. Database/model and index changes

No model changes, data migrations, production index changes, new dependencies, or historical financial rewrites.

The benchmark tested a candidate `{ userId: 1, entryTime: -1 }` index in its temporary database. Existing owner/account/entryTime indexes already constrained the representative two-account date range effectively. The candidate showed no material benefit and was not added to the Trade schema. Single-account date filtering also uses an existing compound index. Revisit indexes using explain on actual account cardinality and workload rather than extrapolating blindly from this fixture.

Both Mongo test tools use uniquely named local `tortoise-analytics-test-*` databases, do not read `server/.env` or `MONGO_URI`, and remove only their generated database. No user trades or private knowledge are seeded, altered, or reset.

## 6. API changes

Added authenticated `GET /api/analytics/summary` with the existing analytics filters. It returns `{ summary, winLossDistribution, rMultipleDistribution }`, using the performance-report zero-baseline convention. It omits chart arrays. Existing dashboard/calendar/report DTOs remain compatible; no chart downsampling or pagination was silently introduced.

Aggregate matching requires an authenticated owner and explicitly casts ObjectId/date filters through the existing Trade schema. HTTP handlers continue deriving ownership from `req.user`, never a query-supplied user ID. Existing account/date/symbol/strategy/setup/session/direction/tag behavior is preserved.

## 7. Frontend changes

None. Existing Dashboard, Calendar, Reports, Strategy and Playbook consumers receive the same data shapes. Responsive layout, light/dark themes, and chart presentation remain unchanged. New clients can choose the compact summary endpoint when chart data is unnecessary.

## 8. Tests added/updated

Ten backend unit tests cover streaming/reference parity, empty and open data, 1/20/1,000-trade fixtures, Decimal boundaries, null handling, ties, strategy identity, first-point drawdown, cast ownership filters, summary/group-only modes, and 150,000 winning trades without spread-argument overflow.

The real-MongoDB suite covers empty/one-trade datasets; wins/losses/breakeven/open trades; absent R/holding values; multiple accounts, strategies and sessions; dates/tags/symbol/setup/direction filters; owner isolation; raw candidate equality on exact fixtures; calendar compatibility; adversarial Decimal precision fallback; full 100,000-trade DTO equality; KPI/distribution adoption at that volume; and repeated-request reproducibility.

An E2E workflow checks unauthenticated access, account/date filters, compact/dashboard/performance-report parity, market/calendar results, and foreign-account isolation through actual HTTP routes.

## 9. Test results

- `npm run ci:verify`: passed, including server/client lint, **356 backend tests**, **88 frontend tests**, and production client build.
- `npm run test:analytics:integration --prefix server`: **9 tests passed**, with real MongoDB and 100,000 owner trades.
- `npm test --prefix e2e`: **51 tests passed**, including existing Replay, Backtesting, private knowledge, ownership, and UI regressions.
- Backend coverage: **81.22% lines, 90.33% branches, 82.65% functions**; existing thresholds pass.
- `git diff --check`: passed.

One test initially expected an aggregate diagnostic while full candidate comparison was disabled; the harness now explicitly enables the experimental path. Another adversarial fixture initially rounded to the same displayed value in both implementations; it was corrected to cross a two-decimal boundary. The production parity guard and full DTO assertions were retained.

## 10. Security

Authentication, authorization, ROOT/ADMIN behavior, CSRF, rate limiting, session security, and owner isolation remain unchanged. The new summary route sits behind the existing authenticated analytics mount. Cursor fields exclude executions, notes, screenshots, and private methodology. No client-accessible switch enables experimental calculations. Benchmark artifacts contain only synthetic IDs/data and query-plan metadata.

## 11. Performance measurements

The committed `PHASE8_BENCHMARK.json` contains three fresh-process runs per mode, Node/Mongo versions, query plans, and raw measurements. Timing includes fetching, calculation, and JSON serialization; it excludes HTTP transport and browser rendering. Heap delta is sampled before/after computation, not a sampled maximum. Peak RSS is the process high-water mark including serialization. Memory numbers include runtime/driver overhead and GC variability, so they are not a strict per-request allocation budget.

The fixture contains 100,000 owner trades, 1,000 foreign-owner trades, two accounts, three strategy IDs, mixed wins/losses/breakeven/open positions, nullable R, four symbols, multiple sessions, and one year of dates. The February calendar selects a smaller monthly subset. Existing API payloads must retain all chart points and duplicate strategy rows, so full response bytes remain unchanged. The candidate-only response is experimental and is **not financially interchangeable** with the legacy DTO for all fields.

Environment: Node v22.23.2, MongoDB 8.3.7, darwin/arm64. Medians of three fresh processes; timings use the existing schema indexes after the candidate index was removed.

| Mode | Response ms | Heap delta MiB | Peak RSS MiB | JSON bytes (uncompressed) |
| --- | ---: | ---: | ---: | ---: |
| legacy-dashboard | 2,692 | 154.99 | 413.23 | 22,063,555 |
| scalable-dashboard | 2,830 | 154.73 | 421.61 | 22,063,555 |
| legacy-calendar | 137 | 14.19 | 128.95 | 5,363 |
| scalable-calendar | 134 | 20.35 | 125.02 | 5,363 |
| legacy-summary | 1,581 | 144.15 | 262.86 | 922 |
| scalable-summary | 1,783 | 70.33 | 245.81 | 922 |
| candidate | 2,422 | 12.67 | 106.86 | 73,610 |

| Query-plan check | Returned | Documents examined | Keys examined | Execution ms |
| --- | ---: | ---: | ---: | ---: |
| Owner/date, existing indexes | 7,672 | 7,672 | 7,677 | 10 |
| Owner/date, candidate index | 7,672 | 7,672 | 7,672 | 15 |
| Owner/account/date | 3,836 | 3,836 | 3,836 | 4 |

Summary-mode median heap delta decreased from 144.15 to 70.33 MiB, while median response time changed from 1,581 to 1,783 ms. These are measured tradeoffs, not a claim of universally lower latency. Production KPI verification still scans the matching records in both the compact pipeline and compatibility cursor; no reduction in total documents scanned is claimed.

The guarded production path intentionally retains a verification pass. It is not universally faster. Group candidates are a foundation for later independently proven migrations, not evidence that they may replace legacy financial semantics now.

## 12. Known limitations

- Dashboard equity/drawdown output remains O(number of closed trades). Large payloads and browser chart rendering remain material limits; preserving the current API precludes silently dropping points.
- Existing strategy ObjectId identity grouping can produce O(trades) output/state. Correcting it requires a separately reviewed financial/reporting behavior change.
- Streaming memory is O(groups + days + narrow equity sequence + required output), not constant for every endpoint. Calendar is bounded by its distinct exit days, and summary still needs narrow ordered inputs for exact tie-sensitive drawdown.
- The full grouped aggregation candidate can differ on binary R averages, tied ordering, and strategy grouping. It remains behind tests/benchmark use.
- Sequential reads are not a transactional database snapshot. Only values identical to the authoritative cursor result are adopted; the existing cursor itself has the same non-snapshot read limitation as legacy find.
- Existing all-account monetary aggregation semantics are preserved; no currency conversion was introduced.
- Existing behavior/execution/Risk/methodology paths still load matching trade arrays. This phase deliberately did not rewrite all consumers.
- Results demonstrate 100,000 synthetic trades on one local environment, not a multi-user production load or browser rendering SLA.
- Experimental daily `$top` aggregation requires MongoDB 5.2+; the production daily path does not use it.

## 13. Remaining technical debt

Resolve strategy identity grouping and explicitly decide whether daily/group R arithmetic should change before enabling those compact group results. Add an explicit, backward-compatible series pagination/resolution contract if 100,000-point browser charts are required. Migrate remaining analytics consumers individually behind parity tests. Profile actual data/account cardinality before adding indexes. Keep the Mongo integration suite in validation wherever a local MongoDB service is available; ordinary unit tests do not replace it.

## 14. Recommended next step

Review the measured rollout and the separate decision needed for compact equity series and value-based strategy grouping. No next phase was started. Tortoise AI, new trading assumptions, and unrelated features remain outside this phase.

### Reproduce

Use the repository-supported Node version and a local MongoDB server:

```sh
npm run ci:verify
npm run test:analytics:integration --prefix server
npm run benchmark:analytics --prefix server
npm test --prefix e2e
```

The benchmark writes `/tmp/tortoise-phase8-benchmark.json` by default. `ANALYTICS_BENCHMARK_COUNT` can change the generated count (1–1,000,000); `ANALYTICS_BENCHMARK_OUTPUT` changes only the report destination. Neither variable selects a user database.
