# Phase 2 — Real Broker Execution Import + Position Reconstruction

## Status

PARTIAL — implementation complete; backend tests and lint pass. Frontend unit/build and Playwright execution could not be completed in this environment because the uploaded macOS `node_modules` were not portable and a clean client reinstall did not finish before the execution timeout. New frontend/E2E tests were added for CI/local verification.

## Audit Findings

The prior import path treated one CSV row as one completed trade. Thinkorswim was explicitly marked as incomplete because Account Statement exports contain individual executions. Trade already supported embedded executions, but there was no persistent execution ledger, no position reconstruction engine, and financial calculations did not apply contract multipliers.

## Implemented

- Thinkorswim Trade History section parser.
- Broker-neutral normalized execution model.
- Persistent user/account-scoped BrokerExecution ledger.
- Deterministic FIFO position reconstruction.
- Partial fills, scaling, partial exits, reversals, overnight and open positions.
- Execution/order provenance and raw broker metadata.
- Options metadata and multiplier handling.
- Common futures multiplier handling with explicit rejection of unknown futures contracts.
- Deterministic source timezone handling for naive Thinkorswim timestamps.
- Execution-level duplicate detection and idempotent ledger import.
- Backward-compatible legacy completed-trade import adapters.
- Expanded ImportJob execution/reconstruction audit data.
- Tortoise Scroll Import Review/Results execution counts and warnings.
- Broker execution data included in backup/restore validation.

## Security

BrokerExecution requires userId and accountId. Import still verifies the destination Account belongs to the authenticated user. Duplicate uniqueness is owner/account/broker scoped. ImportJob lookup remains owner-scoped. No client-supplied userId is trusted.

## Financial Behavior

Trade financial calculations now apply an explicit instrument multiplier. Existing equity/manual trades retain multiplier 1. Open reconstructed positions do not finalize P&L until flat. Unknown futures multipliers are rejected rather than guessed.

## Test Results

Backend: 135 passed, 0 failed, 0 skipped.

Coverage gate: lines 75.28%, branches 85.25%, functions 73.70% — PASS against existing thresholds.

Lint: server + client PASS before the attempted clean client reinstall.

Frontend unit/component and production build: not executable after the uploaded macOS dependency tree was removed; the clean reinstall exceeded the environment execution window.

Playwright: new Thinkorswim reconstruction/idempotency scenario added, but not executed here because it requires the completed frontend install plus MongoDB/browser runtime.

## Known Limitations

- FIFO is the only supported reconstruction policy in Phase 2.
- Thinkorswim is the only broker using the execution-first path in this phase.
- Futures contract multipliers are intentionally limited to a controlled known-spec table; unknown futures require future instrument configuration rather than a silent default.
- If a statement begins with a TO CLOSE execution and the opening execution is absent, it remains unresolved until sufficient history is imported.
- No broker auto-sync is included.

## Recommended Next Phase

Phase 3 — Accounts + Instrument / Contract Configuration, including user-managed futures contract specifications and account trading configuration.
