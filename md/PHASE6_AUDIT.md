# Phase 6 audit

Existing stack: Express/Mongoose owner-scoped BacktestConfig CRUD/run routes; React/MUI BacktestingPage; pure SMA engine; Phase 4 marketDataService provides validated canonical candles, revisions, calendars, contract metadata and cache. Replay uses this same service and remains unchanged.

Relevant backend: backtestController, backtestRoutes, engines/backtestEngine, BacktestConfig. Reusable analytics: computeSummary, buildEquityCurve, buildDrawdownCurve, buildBySetup/Strategy. Decimal is already installed. Existing tests include backtestEngine, marketDataRoutes, ownership/auth, analytics and E2E CRUD flows.

Gaps: same-bar close-to-open look-ahead; stops ignore opening gaps; entry-bar protection absent; implicit costs/session/intrabar assumptions; no extensible rules, futures multiplier, result provenance or shared analytics. Existing stop test incorrectly assumes a gap is capped at the stop.

Plan: extend the engine into definition, causal signal, execution, position and analytics modules. Preserve legacy config/API shape with a disclosed compatibility policy; correct invalid fill behavior. Add versioned strategy/execution fields, explicit confirmation for new simulation assumptions, source/result provenance and a visual configuration editor. No live trade records or AI writes. Generated trades remain in backtest results.

Files: existing BacktestConfig/controller/engine/page plus new backtest modules/editor/tests/docs. Migration: additive fields only, old results retained and identified as legacy. Security: retain authenticated owner filters, strict v2 validation, allowlist configuration writes, no client result/owner injection; use existing owned provider. Risks: intrabar ambiguity, gaps, stale results after edits, timezone/session close look-ahead, tick rounding, unknown contract/currency, and preserving legacy workflows. Tests will cover hand-calculated outcomes and prefix invariance.
