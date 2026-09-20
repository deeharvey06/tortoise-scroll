# Phase 10 audit

The existing React/MUI client uses design-system panels, states, dialogs and a Zustand global filter store. Express routes delegate to services/repositories; Mongoose models are owner scoped behind session authentication and CSRF protection.

Relevant UI: TradeDetailPage, TradesPage, ImportPage, GlobalFilterBar, Topbar, ReportsPage and existing strategies/playbooks/journal pages. Relevant APIs: trade routes/service/repository, import routes/controller/service, settings routes/controller and existing owner-scoped resource routes. Relevant models: Trade, ImportJob, BrokerExecution, AppSettings, Account, Strategy, Playbook, JournalEntry, Tag.

Reuse deterministic trade calculations and import reconstruction unchanged. Extend AppSettings for bounded saved filters/table preferences, add bounded owner-scoped search and metadata-only bulk edits. Preserve reference IDs in APIs while adding separately resolved owned labels. Add paginated import summaries/details and non-destructive duplicate review. Replacement/merge is unsafe with the current immutable execution ledger and journal preservation semantics; expose skip/review only.

Gaps: trade relationship labels absent; import audit API lacks UI and loads row arrays in list requests; visible columns stored across users in browser storage; no ordering/density persistence; bulk classifications and global search missing. Existing tests cover import reconstruction, auth/isolation, settings, filters and browser workflows; add workflow unit/integration/browser regressions.

Likely changes: the components/services/routes/models above, new small workflow components and validation/helpers, tests and reports. Additive optional AppSettings/ImportJob metadata requires no backfill. No financial, authentication or ownership migration. Risks: stale UI fetches, cross-user preferences, unintended bulk overwrites, reference ownership, broad search costs and unsafe duplicate mutation. Address with bounded validation, explicit save/confirmation, owner predicates, limited projections/timeouts and isolation tests. Existing indexes are retained pending evidence for additional indexes.

Implementation, verification results and limitations are recorded in [the Phase 10 completion report](PHASE10_REPORT.md).
