# Phase 3 — Accounts + Trading / Instrument Configuration

## Status

Implementation complete. Verified locally on macOS with Node 22.23.2: 185 backend tests, 60 frontend tests, and 45 Playwright browser tests pass. Server/client lint, backend coverage thresholds, the production client build, and all 22 API smoke checks pass.

## 1. What was implemented

### Accounts

The existing user-owned Account model and API were extended into a complete Accounts workspace:

- account name, broker, account type, currency, starting balance
- active/archive state
- default account selection
- edit, archive, restore, guarded delete
- account performance summary
- account import history
- account-specific trading preferences (default instrument, timeframe, preferred session, timezone, notes)

Existing Risk Settings remain the authoritative risk-configuration system; Phase 3 deliberately does not duplicate daily-loss/risk-limit fields into Account.

### Instrument specifications

A new user-owned `InstrumentSpecification` model and centralized `instrumentSpecificationService` provide the authoritative contract metadata path for futures/options/equities.

Built-in ES and MES definitions are:

- ES: tick size 0.25, tick value $12.50, point value/multiplier 50
- MES: tick size 0.25, tick value $1.25, point value/multiplier 5

The service is also used by execution normalization, CSV execution import, broker API synchronization, manual trade creation/update, and therefore downstream risk/analytics based on canonical trades.

## 2. Architecture / design decisions

- User-specific custom specifications override system specifications.
- Explicit positive broker multipliers take priority over inferred specifications.
- Unknown futures are not assigned multiplier 1; they are rejected from execution persistence until a specification exists.
- Already-persisted trade multipliers are retained during normal updates, preserving historical calculations.
- Account archive/restore is explicit; generic account edits cannot directly toggle `isActive`.
- Deleting an account with dependent trading/journal/import/risk/broker records is rejected; archive is the safe workflow.
- Archived accounts are excluded from trade creation/import/broker mapping. Existing broker mappings to an archived account are skipped with a sync warning instead of corrupting history or failing ownership checks.
- Every account/specification API query is ownership scoped server-side. ROOT/ADMIN status does not implicitly bypass the user's trading-data ownership boundary.

## 3. Files created

- `server/src/models/InstrumentSpecification.js`
- `server/src/services/instrumentSpecificationService.js`
- `server/src/routes/instrumentSpecificationRoutes.js`
- `server/tests/instrumentSpecificationService.test.js`
- `server/tests/instrumentSpecificationRoutes.test.js`
- `server/tests/accountRoutes.test.js`
- `client/src/services/accountService.js`
- `client/src/services/instrumentSpecificationService.js`
- `client/src/pages/Accounts/AccountsPage.jsx`
- `client/src/pages/Accounts/AccountsPage.test.jsx`
- `e2e/tests/accounts-instruments.spec.js`
- `INSTRUMENT_SPECIFICATIONS.md`
- `PHASE3_REPORT.md`

## 4. Files modified

- `server/src/models/Account.js`
- `server/src/models/BrokerExecution.js`
- `server/src/services/executionNormalizationService.js`
- `server/src/services/importService.js`
- `server/src/services/brokerSyncService.js`
- `server/src/services/tradeService.js`
- `server/src/controllers/importController.js`
- `server/src/controllers/backupController.js`
- `server/src/app.js`
- `server/scripts/migrateOwnership.js`
- `server/tests/isolation.test.js`
- `client/src/services/tradeService.js`
- `client/src/router.jsx`
- `client/src/layout/navigation.jsx`
- `client/src/layout/navigation.test.jsx`

The previously excluded auth/import-test-fix files were not changed in this phase.

## 5. Database/model changes

### Account additions

- `accountType`
- `archivedAt`
- `tradingConfig.defaultInstrumentSymbol`
- `tradingConfig.defaultTimeframe`
- `tradingConfig.preferredSession`
- `tradingConfig.timezone`
- `tradingConfig.notes`

All additions are backward-compatible defaults/optional values. No destructive migration is required.

### New InstrumentSpecification

User-owned custom contract metadata with a unique `(userId, symbol, assetType)` index.

### BrokerExecution

`multiplierSource` now accepts `user-spec` so a custom instrument specification can be audited after enrichment.

## 6. API changes

### Accounts

- `GET /api/accounts` — all owned accounts
- `GET /api/accounts?active=true` — active owned accounts only
- `GET /api/accounts/:id`
- `GET /api/accounts/:id/performance`
- `GET /api/accounts/:id/import-history`
- `POST /api/accounts`
- `PUT /api/accounts/:id`
- `POST /api/accounts/:id/default`
- `POST /api/accounts/:id/archive`
- `POST /api/accounts/:id/restore`
- `DELETE /api/accounts/:id` — only when there are no dependent records

### Instrument specifications

- `GET /api/instrument-specifications`
- `GET /api/instrument-specifications/resolve?symbol=...&assetType=...`
- `POST /api/instrument-specifications`
- `PUT /api/instrument-specifications/:id`
- `DELETE /api/instrument-specifications/:id`

All routes require authentication and all custom data is owner-scoped.

## 7. Frontend changes

A new `Accounts & Instruments` workspace appears under Trading and provides:

- active account table
- default-account selection
- account performance expansion
- recent import history
- add/edit/archive/restore/delete workflows
- custom instrument specification CRUD
- built-in futures specification reference
- Tortoise Scroll responsive table/dialog styling
- dark/light theme compatibility

Existing account selectors now request only active accounts so archived accounts cannot accidentally receive new trades/imports.

## 8. Tests added / updated

Backend coverage added for:

- Account ownership filtering
- client-supplied userId stripping
- owner-scoped update/default/archive/restore/delete behavior
- inactive/default restrictions
- guarded delete with dependent records
- ES/MES futures specifications
- futures multiplier resolution
- option multiplier resolution
- no multiplier-1 guess for unknown futures
- ES deterministic P&L fixture
- custom-spec ownership/unique index
- duplicate/invalid custom specification requests
- custom-spec cross-user update denial
- InstrumentSpecification inclusion in ownership/isolation audit

Frontend coverage added for:

- account/spec workspace rendering
- default account workflow
- built-in ES/MES display
- dark theme render
- light theme render

Playwright scenario added for:

- account creation/default workflow
- custom futures specification creation
- built-in ES visibility
- direct foreign account ID denial

## 9. Test results

- Backend tests: **185 passed, 0 failed, 0 skipped**.
- Backend coverage gate: **76.61% lines, 85.45% branches, 77.23% functions** — all configured thresholds pass without lowering them.
- Server ESLint: **PASS**.
- Client ESLint: **PASS**.
- Frontend Vitest: **60 passed across 15 files**.
- Playwright E2E: **45 passed**, using Chromium and the dedicated local E2E database.
- Production client build: **PASS**.
- Authenticated API smoke checks: **22 passed**. Run against a dedicated test database with `SMOKE_EMAIL` and `SMOKE_PASSWORD`; accounts with retained risk settings are archived.
- Verification fixes: installed the missing `@testing-library/user-event` dependency, corrected ambiguous selectors and login navigation timing, enabled reset-token exposure only for the E2E server, and updated smoke checks for authentication, CSRF, and account deletion safeguards.
- Added regression tests for missing account access and empty account performance. Node **22.23.2** is pinned in `.nvmrc`; use `nvm install && nvm use` before running checks.

## 10. Security considerations

- Account and custom-specification ownership is always derived from authenticated `req.user.id`.
- Client `userId` is stripped.
- Direct-ID access is owner-scoped and returns not found for another user's record.
- ADMIN/ROOT role does not automatically grant access to another user's trading accounts.
- Archived accounts cannot receive new imports or trade creation.
- Broker auto-sync skips archived mappings and reports a warning instead of mutating historical user data.

## 11. Performance considerations

- Account/spec queries have ownership-oriented indexes.
- Built-in instrument lookup is in-memory O(1).
- Custom override lookup uses the unique `(userId, symbol, assetType)` index.
- Account performance currently reads owned account trades and calculates the compact summary in Node. This is correct for the existing scale and can migrate to aggregation during the planned Analytics Scalability phase.

## 12. Known limitations

- Built-in futures catalog is intentionally finite; unknown contracts require a user custom specification.
- Session open/close metadata is stored but not yet consumed by Replay/Backtesting because those future phases are out of scope.
- Account currency conversion is not implemented; analytics continue to use the existing application's currency assumptions.
- Archiving an account does not delete or rewrite historical records.

## 13. Remaining technical debt

- Local verification is complete; hosted CI should run the same checks on its target environment.
- Expand the built-in contract catalog only as real trading requirements demand it, rather than scattering new symbol constants through the codebase.
- Future Replay/Backtesting must resolve instrument metadata through `instrumentSpecificationService`.

## 14. Recommended next phase

Phase 4 — Market Data Infrastructure. Tortoise AI remains out of scope.
