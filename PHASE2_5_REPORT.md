# Phase 2.5 Report — Broker Connection + Automatic Execution Sync

## Status

PARTIAL PASS: implementation complete for the broker-connection architecture and Thinkorswim/Schwab adapter. Five new dependency-free backend unit tests pass. The full server/client/E2E suites could not be executed in this container because clean dependency installation timed out; those tests are included for the normal CI environment.

## Implemented

- Broker provider registry/abstraction.
- Thinkorswim/Schwab OAuth provider adapter.
- AES-256-GCM token encryption with key IDs for rotation.
- Single-use OAuth state tied to authenticated user/session.
- BrokerConnection, BrokerAuthorizationState and BrokerSyncRun models.
- Explicit brokerage-account -> Tortoise Scroll Account mapping.
- Initial sync after mapping from the UI.
- Per-account incremental checkpoints.
- Retry-safe execution-ledger persistence.
- CSV/API execution provenance and overlap deduplication via the Phase 2 ledger.
- Reuse of the Phase 2 FIFO position reconstruction engine.
- Broker/local open-position reconciliation warnings.
- Manual Sync Now.
- Automatic local scheduler with retry-safe service boundary.
- Authorization-expired reconnect flow.
- Sync history.
- Secure disconnect preserving historical journal/trade data.
- Settings -> Broker Connections UI with dark/light design-system primitives.
- Frontend component test and Playwright broker-connection scenario.
- New broker-owned models added to the user-ownership regression inventory.

## Security

No provider tokens are returned to the browser or admin APIs. Tokens are encrypted before persistence. OAuth state is hashed, session-bound and expiring. Connection IDs, mappings, history, sync and disconnect operations are all ownership-scoped. Client-supplied `userId` is never used.

## New unit tests executed

5 passed / 0 failed / 0 skipped:

1. secret encryption/decryption
2. token redaction
3. public provider capability registry
4. OAuth URL excludes client secret
5. Thinkorswim order execution normalizes into the Phase 2 execution model

## Full-suite limitation

`npm ci --prefix server` did not complete in the execution container before transport timeout, so the dependency-backed server suite, Vitest and Playwright were not executed here. No passing result is claimed for suites that were not run.

## Read-only product boundary

The implementation does not expose order submission, modification, cancellation, position closing, funds transfer or withdrawals. Synchronization is journaling/analytics ingestion only.

## Excluded files

Per explicit instruction, Phase 2.5 does not modify or include the three previous test-fix files:

- `e2e/playwright.config.js`
- `e2e/tests/auth.spec.js`
- `client/src/pages/Import/ImportPage.test.jsx`
