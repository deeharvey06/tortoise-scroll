# Methodology coverage report — Phase 10.5

Audit date: 2026-09-20. Application baseline `d1c23d4`. No methodology was edited, approved, rejected, merged, or reinterpreted.

## Evidence and scope

Read-only inspection of the configured ROOT owner's actual `KnowledgeSource`, `KnowledgeItem`, `KnowledgeRelationship`, strategies, playbooks, classified trades and structured preparation records. Queries were bounded and returned without truncation. See [sanitized metadata](md/audit-evidence/phase10_5/methodology-metadata.json). This is an actual database inventory, separate from synthetic test coverage.

Source evidence: `server/src/models/KnowledgeSource.js`, `KnowledgeItem.js`, `KnowledgeRelationship.js`; `server/src/services/knowledge/{ingestion,schema,knowledgeService,tradeContext,integration,processAnalytics}.js`; `server/scripts/importKnowledgeBundle.js`; `server/tests/knowledge.test.js`.

## Supplied sources

| Source family              | Source records | Extracted sections | Referencing items | Approved items | Source review/completeness                             |
| -------------------------- | -------------: | -----------------: | ----------------: | -------------: | ------------------------------------------------------ |
| Price Action Fundamentals  |             30 |                101 |                26 |              0 | 30 need review                                         |
| How To Trade Price Action  |             18 |                135 |                 2 |              0 | 18 need review; particularly sparse concept extraction |
| Price Action Bonus         |              4 |                 17 |                11 |              0 | All 4 marked incomplete and need review                |
| Percentage and Probability |              1 |                 22 |                 5 |              0 | Needs review                                           |
| Pre-Market Analysis        |              1 |                  1 |                 1 |              0 | Needs review                                           |
| Star Points                |              1 |                  9 |                91 |              0 | Needs review                                           |
| Trade Entries              |              1 |                 11 |                12 |              0 | Needs review                                           |

Items can reference multiple source families, so the referencing-item column must not be summed. All 56 preserved original files exist and match their stored checksums. All seven originally supplied Desktop archive/PDF paths are absent now. Consequently, preserved-file integrity is verified, but completeness against the original archives is UNVALIDATED. Extracted text is not proof that diagrams, scanned text, or all intended concepts were understood; ingestion has no OCR. No external material was substituted.

## Graph quality

| Check                                                       | Observed result | Interpretation                                                                                                 |
| ----------------------------------------------------------- | --------------: | -------------------------------------------------------------------------------------------------------------- |
| Items                                                       |             143 | 23 concepts, 11 patterns, 10 trade entries, 5 probabilities, 91 star points, 1 premarket principle, 2 warnings |
| Approved / needs review / rejected / superseded             | 0 / 143 / 0 / 0 | No authoritative approved knowledge set                                                                        |
| Relationships                                               |               6 | All `entry_for`, all need review                                                                               |
| Items without sources or status                             |           0 / 0 | Structural provenance/status present                                                                           |
| Invalid source/section references / invalid edge endpoints  |           0 / 0 | Referential checks pass for audited owner                                                                      |
| Items without any relationship                              |             135 | Graph orphans, not source-less items                                                                           |
| Star Points without relationships                           |              91 | Matching relationships missing                                                                                 |
| Probability items without conditions                        |               0 | Conditions present as text; applicability/calibration not verified                                             |
| Trade Entries without context links                         |              10 | No edge to market-context/pattern/setup under this audit's graph check                                         |
| Strategies / without direct Trade Entry links               |         10 / 10 | Strategy names are not validated methodology links                                                             |
| Playbooks                                                   |               0 | No actual playbook-context linkage to validate                                                                 |
| Duplicate normalized-name groups                            |               2 | Review candidates; not established semantic duplicates                                                         |
| Duplicate extracted-source-text groups                      |               3 | Could be repeated course material; preserve provenance pending review                                          |
| Explicit conflicts                                          |               0 | No recorded conflicts; semantic consistency unvalidated                                                        |
| Missing dimensions                                          |              98 | Dimension omission can be valid for some kinds; review suitability, do not auto-fill                           |
| Manually classified trades / structured preparation records |           0 / 0 | Feature tests exist; no actual usage dataset here                                                              |

Ambiguity is not reliably machine-countable from these fields. `needs_review` includes unverified extraction, not necessarily ambiguous methodology. Human review must establish definitions, contradictory statements, source scope, conditions, negative examples, applicability and causal confirmation timestamps. Existing revision history and source references are reusable. No auto-approval is justified by referential integrity.

## Current context: manual versus automatic

| Field/family                                             | Current origin                                                             | Automatic market-context detection                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Trend, Trading Range, Always In Long/Short               | User-selected methodology/context; source-derived candidate concepts       | Not implemented                                    |
| H1/H2/H3, L1/L2/L3                                       | User-entered/selected labels where recorded                                | Not implemented                                    |
| ii, ioi, OO, Wedge                                       | User-entered pattern context                                               | Not implemented                                    |
| Failed Breakout, Breakout Pullback, Major Trend Reversal | User-entered context/strategy labels                                       | Not implemented                                    |
| Micro Gap, Body Gap                                      | User-entered methodology classification                                    | Not implemented                                    |
| Signal-bar quality, follow-through, opening pattern      | User-entered structured context                                            | Not implemented                                    |
| Trade Entry, setup, Strategy, Playbook, Star Points      | User-selected owned entities/approved knowledge links                      | Not automatically matched from market state        |
| Probability guidance                                     | Methodology-derived reviewed text mechanism; current five items unapproved | Not an empirical personal win probability          |
| Side, fills, prices, quantity, costs                     | Import-derived or manual journal fields                                    | Reconstruction deterministic after normalization   |
| Candle session/trading date                              | Deterministically assigned from declared calendar                          | No authoritative exchange-calendar acquisition     |
| EMA/VWAP, visible session high/low                       | Deterministically calculated from visible bars                             | Indicators, not methodology classification         |
| Inside bar / price-vs-EMA strategy predicate             | Deterministic backtest rule                                                | Narrow rule primitive, not full context engine     |
| Planned versus actual size/stop/risk/timing; adherence   | Deterministic comparisons plus explicit manual inputs                      | Historical process analytics, not live observation |

The dimensions represented in actual records include market structure (6), always-in (2), signal (6), pattern (5), gap characteristic (2), signal quality (1), follow-through (1), trade intent (2), entry mechanism (3), trade entry (10), opening pattern (6), preparation (1). Counts are candidates, not confirmed labels.

## Integration and validation readiness

Preparation supports narrative, structured scenarios, invalidation and planned setups; trade context can retain selected knowledge/plan snapshots and revisions. Strategy/Playbook integrations can link approved items and compute historical grouped results. `processAnalytics.js` compares explicitly recorded plans to executions and reports sample counts. These are manual-context analytics; no automatic pattern detector was found. Correlation in a small labeled subset is not causal proof or a validated probability.

Fixtures in `server/tests/fixtures/{market-data,replay,backtest,analytics}` test arithmetic, temporal behavior, ownership and integrity. They are not human-verified ES market-context ground truth. No sufficient human-labeled historical ES session dataset was found. Future dataset work must include trending/ranging/transition sessions, DST/early-close boundaries, positive and negative examples, inter-reviewer disagreement and label availability at time T. Reserve held-out sessions; do not tune and validate on the same labels.

## Required follow-up

- CTX-001: establish a human-verified ES validation dataset before Phase 12.
- CTX-002: define causal context contracts/confirmation timing before Phase 12.
- KNOW-001: review source coverage and all high-value candidates before authoritative Phase 13 matching.
- KNOW-002: review graph relationships, duplicate/conflict candidates, contextual applicability and strategy links before Phase 13.

These do not require implementing a live provider in this audit. Knowledge infrastructure is TEST VALIDATED; methodology authority/coverage is PARTIAL and unvalidated. No Phase 12/13 readiness claim follows from Phase 7 feature completion.
