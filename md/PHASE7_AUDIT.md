# Phase 7 audit and proposed domain model

Status: implemented; see `PHASE7_REPORT.md` for validation, operating policies, and limitations. Scope is Phase 7 only; no AI, live detection, trading controls, or Phase 8.

## Existing architecture

Express/Mongoose owns authenticated APIs; React/MUI uses the existing protected router, shared panels, themes, and Axios CSRF client. Ownership comes from the session, including for ROOT/ADMIN personal data. Trade contains aggregate financial facts and embedded executions; BrokerExecution preserves import records. Account defines currency and instrument settings. Strategy and Playbook already hold rule text and associated-trade performance. JournalEntry already supports pre-market freeform plans. Tags, setup text, mistake/emotion arrays and nullable followedPlan/followedRules must remain intact.

The existing Decimal-based analytics service provides summary, equity, drawdown, grouping and process counts. Risk uses user-configured settings. Replay separates historical overlays from decisions and prevents future leakage; Backtesting uses its deterministic simulator and Phase 4 market-data service. Phase 7 does not change their execution or market-data assumptions. Existing heuristic auto-tagging is not a source of methodology approval.

Current gaps: no private document provenance or knowledge review, no reusable approved taxonomy, no source-backed relationships, no structured pre-market scenarios, and no explicit execution-plan comparison. Journal's current pre-market fields serialize into text. Analytics filters share buildTradeQuery; knowledge filters must be additive. Existing owner-bound demo seeding must not acquire private course material. Backups and ownership migration enumerate models explicitly and require updates for new records/references.

## Supplied source audit

56 PDFs across seven source types, extracted with original SHA-256 and page numbers. All extracted pages read; empty final pages checked visually. Original PDFs remain unchanged. Bonus is incomplete. No internet material was used.

Repeated text appears under different filenames/chapters: Scaling In / Trade Management; Protective Stops / Orders; Always In / Market Cycle. Preserve each source occurrence and flag identical content, without manufacturing a missing lesson. The Percentage/Probability compilation contains percentages describing retracement or sizing as well as outcome probabilities; a percentage alone is not a probability item. Star Points includes empty lesson headings, which are not knowledge claims.

Trade Entries has apparent risk/reward substitutions and buy/sell inconsistencies in short sections. These require explicit review and must not be silently corrected. Opening notes include distinct qualifications for strong trends, minor/major reversals, gap sizes and time horizons; preserve them separately. Pre-market notes explicitly support multi-timeframe patterns, levels, prior-session context, Asian range and opening preparation. Literal PST session notes require clarification before any DST-aware automation; no automatic session detection is introduced.

## Proposed model and integration

- Private source documents: immutable original bytes, checksum, supplied source type, title/location, incomplete flag, page/section text, extraction warnings. No public upload URLs.
- One KnowledgeItem model discriminated by kind (concept, pattern, entry, setup, context, guideline, rule, warning, exception, probability, Star Point, premarket, management, risk). Dimensions remain extensible strings. Source references retain full excerpts and page/section locations. Structured interpretation stays separate from source text.
- KnowledgeRelationship: directed typed edge, source evidence, independent review status. No adjacency-based automatic relationships.
- Review states: needs_review, approved, rejected, superseded. Editing approved content withdraws approval; version/history remains visible. Only approved items/edges may be attached as active methodology.
- Extend existing Strategy/Playbook with approved knowledge references. Explicit user action creates inactive drafts or enriches existing records. Repeated draft requests are idempotent.
- Extend JournalEntry with structured context, levels and named IF/context/look-for/avoid/invalidation scenarios alongside existing freeform content.
- Extend Trade with an approved knowledge snapshot, premarket scenario association, explicit execution plan, and manual tri-state review. Historical financial facts remain authoritative. Missing inputs produce unavailable comparisons, not guessed failures.
- Pure process evaluator derives only documented comparisons backed by numeric/timestamp inputs and explicit thresholds. Subjective setup/context questions remain manual.
- Context analytics reuse deterministic existing metrics, report sample and R coverage, and partition monetary results by account currency. Knowledge probabilities never change based on personal outcomes.
- Shared methodology UI serves Knowledge Explorer, Strategy/Playbook, Journal, Trade Detail/Review and Reports/Analytics. No trading rules inside chart components.

## Changes, migration and risks

Likely changes: new knowledge models/services/routes/UI/tests; additive fields and validation in Trade, JournalEntry, Strategy and Playbook; private source upload; navigation; analytics integration; backup/migration registry; source import tooling and documentation. Old documents require no destructive migration. Missing new fields mean unclassified/unplanned, never inferred historical classifications.

Primary risks: cross-owner source/relationship references, raw legacy update endpoints bypassing approval, backup restoration reactivating unreviewed claims, concurrent edits, duplicate drafts, PDF resource exhaustion, context leaks in blind replay, mixed-currency analytics, and retroactively edited plans masquerading as pre-trade evidence. Address with scoped server queries, strict request schemas, version checks, bounded file parsing, immutable snapshots/recorded timestamps and explicit labels. Source material stays out of tracked code and global seed data.

Existing baseline from Phase 6: 328 backend, 81 frontend, 48 E2E tests. Run current suites after implementation; baseline counts are historical evidence, not Phase 7 validation.
