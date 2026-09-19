# Phase 6 completion report — Backtesting 2.0

## 1. Implemented

A deterministic strategy backtesting foundation using existing Phase 4 market data: versioned AND rules, EMA comparison, SMA crossover, current/previous inside bar, session filters, market/stop/limit entries, signal-extreme/fixed/percentage stops, R/percentage targets, optional opposite-cross exits, explicit simulation assumptions, and results from existing analytics. A visual strategy editor complements the preserved SMA editor. No Tortoise AI or live-order functionality was implemented.

## 2. Architecture/design decisions

Market Data → Strategy Definition → causal Signal Engine → Execution Simulator → Position Engine → simulated Trades → existing Analytics. Rules are validated data, not executable scripts. Signals consume one completed bar at a time; generated orders are eligible only on the next bar. The simulator and financial calculations remain outside React and Express.

Market data, calendars, source revisions and instrument metadata come from existing services. Canonical market-data responses add the calendar from the same described revision, avoiding a race from separately reloading session boundaries. Decimal handles financial math. Intrabar paths, costs, session behavior, pending orders and range-end behavior are explicit and retained in results. New configurations require acknowledgement of execution assumptions.

## 3. Files created

- `server/src/engines/backtest/definition.js`
- `server/src/engines/backtest/signalEngine.js`
- `server/src/engines/backtest/executionSimulator.js`
- `server/src/engines/backtest/positionEngine.js`
- `server/src/services/backtestService.js`
- `client/src/pages/Backtesting/StrategyEditor.jsx`
- `client/src/pages/Backtesting/ResultDetails.jsx`
- `server/tests/fixtures/backtest/helpers.js`
- `server/tests/backtestV2.test.js`
- `client/src/pages/Backtesting/StrategyEditor.test.jsx`
- `e2e/tests/backtest-v2.spec.js`
- `md/PHASE6_AUDIT.md`, `md/BACKTESTING.md`, `md/PHASE6_REPORT.md`

## 4. Files modified

- `server/src/engines/backtestEngine.js`: orchestrator and backward-compatible legacy adapter.
- `server/src/controllers/backtestController.js`: validated/allowlisted inputs, versioned execution, result invalidation on edits and conditional result writes.
- `server/src/models/BacktestConfig.js`: additive definition/execution/dataset/version fields.
- `server/src/services/marketDataService.js`: additive revision-consistent calendar response.
- `client/src/pages/Backtesting/BacktestingPage.jsx`: strategy editor integration, assumption disclosure, currency-aware results and detailed report.
- `server/tests/backtestEngine.test.js`: replace investigated incorrect look-ahead/gap expectations with manually calculated outcomes.
- `server/tests/marketDataRoutes.test.js`: versioned run authorization, repeated-result equality, CSRF, ROOT/ADMIN/USER isolation and concurrent-edit protection.
- `README.md`: current phase and operating-guide links.

## 5. Database/model changes

`BacktestConfig` gains `engineVersion`, `datasetId`, `strategyDefinition`, and `execution`. Existing documents/defaults, legacy fields, prior results, and user ownership are preserved. No destructive migration is needed. Existing backup handling automatically includes the new fields. Simulated trades are stored only within the backtest result and never inserted into real `Trade` documents.

## 6. API changes

Existing authenticated `/api/backtest/configs` CRUD and `/configs/:id/run` remain. Version 2 input fields are additive. Results retain legacy `trades`, `equityCurve`, and `summary`, and add engine/strategy/policy/source/contract provenance, execution events, open/pending positions, Total R, drawdown curve and strategy/setup breakdowns. Canonical candle responses now include their calendar.

Input fields are allowlisted; clients cannot inject cached results, ownership or run timestamps. Editing clears stale cached results. Concurrent edits/deletion prevent an in-flight versioned run from saving against a different configuration. Invalid assumptions return explicit errors; missing data never silently falls back to simulation fixtures.

## 7. Frontend changes

Responsive MUI strategy editor using existing themes and application primitives. Users select their dataset, timestamp range, conditions, order/risk rules, quantity, costs and execution policies. Loading, empty catalog, validation/provider errors, saving, success, no-trade, rejected-entry, pending-order and open-position states are exposed. Assumptions and executed definitions remain inspectable alongside results. Existing SMA configuration workflows remain available; archived proof-of-concept results are identified.

The real-browser test caught an incorrect dataset-envelope assumption in the new editor; it was fixed against the existing Phase 4 `{ datasets }` API contract, and the component fixture was corrected to match that contract.

## 8. Tests added/updated

Hand-calculated fixtures test causal signals, EMA/inside-bar/session conjunctions, duplicate SMA conditions, market/stop/limit fills, next-bar expiry, opening gaps, explicit intrabar ordering, entry-bar protection, large-slippage immediate protection, invalid post-gap stops, rounding, commissions, quantities, multipliers, negative prices, R/percentage targets, position transitions, session/end policies, UTC/DST breaks, dated futures/fractional rejection, missing/adjusted/partial data, future perturbation and byte-identical repeated results.

HTTP tests exercise authentication/CSRF/owner boundaries including ROOT/ADMIN/USER, trusted source access and stale result-write rejection. Component tests cover both themes, assumption acceptance, payloads, costs, errors and result disclosures. E2E covers create/edit/run, exact expected two-trade/$5 result, identical rerun, zero journal-trade writes, source gaps, owner isolation, light/dark and mobile layouts. Existing Replay tests remain active.

## 9. Test results

- `npm run ci:verify`: passed — lint, **328 backend tests**, **81 frontend tests**, and production build.
- `npm run test:coverage`: coverage gates passed — **82.73% lines, 89.90% branches, 83.83% functions** on the 327-test coverage run before the final duplicate-condition regression was added. The final 328-test CI run includes that regression and its fix.
- `npm run e2e`: **48 browser scenarios passed**, including Backtesting 2.0 and preserved Replay.
- Final affected browser rerun (`backtest-v2.spec.js`, `market-data.spec.js`): **2 passed** after the revision-consistent calendar and final simulator fixes.
- `git diff --check`: passed.

One frontend attempt encountered four timeouts in existing suites. The unchanged tests passed on a bounded-worker rerun and subsequently in the standard CI command; no assertions or timeout thresholds were weakened.

Verification uses supported Node 22 and the isolated `trading-journal-e2e` database. Fixtures are deliberately artificial and are not added to production catalogs.

## 10. Security considerations

All configuration, dataset and instrument lookups use the authenticated owner. ROOT/ADMIN cannot read or run another user's private backtest. Existing authentication, session, CSRF, origin and rate-limit protections are preserved. Rules cannot execute arbitrary code. Input validation and bar/rule/period/quantity limits bound work. No external provider connection, credentials, AI calls or live-order side effects were added.

## 11. Performance considerations

Reuse Phase 4 normalized-data caching. Single-symbol synchronous runs are limited to 5,000 bars and twelve rules, with periods up to 500, bounding CPU and saved result size. Signal state keeps only trailing history. Results use existing deterministic analytics functions; there is no second analytics implementation. Trades/events remain in the existing configuration result. Larger runs, background execution and paginated reporting are future work.

## 12. Known limitations

OHLC intrabar paths are explicit assumptions, not observed ticks. Full fills on touch ignore volume, queueing, partial fills, capital/margin, borrow/funding and additional exchange fees. One position/direction/symbol per run; no scaling, portfolio, OR/nested arbitrary rules, optimization or FX conversion. Signals/indicators warm up only within the selected range. Exact intrabar timestamps are unknown and disclosed as bar-resolution estimates.

Futures require dated single-contract symbols and confirmed metadata; no automatic rollover. Adjusted data is rejected; corporate actions are not modeled. Equity instrument defaults do not invent tick sizes; missing tick metadata must be configured through existing instrument specifications. Realized statistics exclude open positions; unrealized P&L is separate. Cash/R rounding follows current analytics conventions. Existing dependency warnings remain unrelated to Phase 6.

Legacy SMA reruns now correctly use next-bar execution and adverse gap fills. Their results may differ from archived outputs; this is a documented correctness change, not a silent strategy migration. Legacy numeric tick resolution is not market tick metadata; new strategies use confirmed instrument ticks.

## 13. Remaining technical debt

Consider incremental SMA sums for larger workloads, background jobs, result-list/detail pagination, more complete portfolio accounting and corporate-action data, immutable dataset archives, and richer expression composition. These are not presented as implemented features. No next phase was started.

## 14. Recommended next phase

Validate selected strategies against the user's own confirmed datasets and execution conventions. Any expansion of order types, rule expressions, portfolio simulation or Tortoise AI requires explicit approval. Stop at Phase 6.
