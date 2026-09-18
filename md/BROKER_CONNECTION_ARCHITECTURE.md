# Broker Connection Architecture — Phase 2.5

Tortoise Scroll broker connections are read-only data-ingestion integrations. Broker API data is normalized into the same `BrokerExecution` ledger used by Phase 2 CSV imports; the existing FIFO position reconstruction engine remains the only component that creates/updates canonical trades.

## Pipeline

Broker OAuth/API -> provider adapter -> normalized executions -> BrokerExecution -> position reconstruction -> Trade -> journal/reports/analytics.

CSV and API provenance are recorded in `BrokerExecution.sources`. Stable broker execution IDs are preferred for idempotency. When both CSV and API produce the same execution key, the ledger remains a single execution and records both source observations.

## Provider abstraction

`server/src/services/brokers/providerRegistry.js` hides provider-specific behavior. The Thinkorswim provider is implemented as a Schwab Trader API-compatible OAuth adapter. OAuth/API endpoints are environment-configurable so deployments can follow the provider application's registered URLs without changing the domain/reconstruction layer.

Current exposed capabilities: executions, orders (used to derive fills), positions, incremental synchronization, options metadata, and futures metadata. Balances, webhooks, and transaction-history ingestion are not advertised as implemented.

## Token security

Access and refresh tokens are never returned from API responses. Persistent tokens are encrypted with AES-256-GCM by `brokerSecretService.js`. Keys live outside MongoDB in `BROKER_TOKEN_ENCRYPTION_KEYS`; `BROKER_TOKEN_ACTIVE_KEY_ID` supports future key rotation. OAuth state is random, stored only as a SHA-256 hash, tied to the authenticated user and session, expires after ten minutes, and is single-use.

## Ownership

`BrokerConnection`, `BrokerSyncRun`, and `BrokerAuthorizationState` require `userId`. Every connection/sync/account-mapping query is scoped to the authenticated user. A mapping can only reference a Tortoise Scroll `Account` owned by that same user. ROOT/ADMIN status does not bypass broker-credential ownership.

## Sync/checkpoints

Checkpoints are per brokerage account, not global per connection. They advance only after fetched executions are persisted and reconstruction/reconciliation finishes successfully. If processing fails after data persistence but before checkpoint commit, retry is safe because execution ledger uniqueness deduplicates the overlap.

The local/modular-monolith scheduler uses a recursive timeout and a dedicated `brokerSyncService` boundary. This is appropriate for the current single-process application, but it is not a durable distributed job scheduler. A horizontally scaled deployment should move the scheduler boundary to a durable worker/queue/lease system without changing provider or reconstruction logic.

## Reconciliation

When the provider supports positions, each sync compares broker net positions to positions reconstructed from the execution ledger. Discrepancies are warnings; they do not overwrite user-authored journal fields. Existing trade updates merge execution/financial data while retaining notes, screenshots, strategy, playbook, setup, emotions, mistakes and process-review data.

## Disconnect

Disconnect clears encrypted credentials and disables future sync while preserving BrokerExecution, Trade and journal history. Provider-side revocation is attempted where the provider supports it.

## Known limitations

- Live Thinkorswim/Schwab connectivity still requires a valid provider developer application, client credentials and registered callback URI.
- The provider's order response may not contain complete derivative commission/fee data. Missing cost data is surfaced as a sync warning rather than silently asserted to be complete.
- Initial history is capped at 60 days by default (`THINKORSWIM_INITIAL_SYNC_DAYS`) and can be configured lower; broader history may require provider transaction/history APIs in a future phase.
- The current scheduler is single-process and non-durable across process downtime.
- No webhook integration is implemented because the current provider adapter does not advertise webhook support.
- Broker order placement, modification, cancellation and funds movement are intentionally out of scope.
