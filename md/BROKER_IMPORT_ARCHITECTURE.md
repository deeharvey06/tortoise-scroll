# Broker Execution Import Architecture

Phase 2 introduces an execution-first import path for Thinkorswim while preserving the existing completed-trade CSV adapters.

## Pipeline

Broker File → Broker-Specific Parser → Normalized Executions → Execution Ledger → FIFO Position Reconstruction → Open/Closed Trades → Existing Analytics / Journal

## Thinkorswim

Thinkorswim Account Statement exports are parsed from the `Trade History` execution section. Each row is normalized into a broker-neutral execution. Rows marked cancelled/rejected do not affect position state. Malformed rows are reported; ambiguous CLOSE rows without a known opening position are left unresolved rather than guessed.

Thinkorswim timestamps often omit a timezone. The import UI now sends an explicit `sourceTimezone` (defaulting to the browser timezone) so server parsing is deterministic and independent of the server machine timezone.

## Execution Ledger

`BrokerExecution` persists immutable broker provenance including user/account ownership, broker, execution/order IDs, instrument identity, side, quantity, price, time, costs, multiplier, options metadata, position effect, status, and raw broker metadata.

Duplicate protection is scoped by `userId + accountId + broker + executionKey`. Broker execution IDs are preferred. When the broker does not provide one, a deterministic fingerprint is used; identical rows receive stable occurrence suffixes within a file.

## Reconstruction Policy

Phase 2 supports FIFO only. The engine is broker-neutral and groups executions by a canonical instrument key. It handles scale-in, partial exits, full exits, reversals through flat, multiple same-symbol round trips, overnight positions, and still-open positions.

If broker-provided position-effect metadata conflicts with inferred position state, the execution is left unresolved and a warning is recorded.

## Multipliers

Options use the standard 100 contract multiplier. A controlled contract-spec table is used for common futures such as ES/MES/NQ/MNQ. Unknown futures multipliers are rejected instead of silently assuming 1.

## Backward Compatibility

Generic CSV, NinjaTrader, TradeStation, and Interactive Brokers remain on the existing completed-trade import path. Their API behavior is preserved.

## Auditability

Trades reconstructed from broker executions retain source execution identifiers. ImportJob now records execution/trade counts, duplicates, warnings, rejected rows, reconstruction policy, source timezone, and open-position count. Broker executions are also included in user backups.
