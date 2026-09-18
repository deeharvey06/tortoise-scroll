# Instrument / Contract Specifications

Phase 3 centralizes contract metadata so imports, trade reconstruction, manual trade creation, risk calculations, and future Replay/Backtesting can resolve financial multipliers through one authoritative path.

## Resolution order

For an authenticated user, `instrumentSpecificationService` resolves a specification in this order:

1. An active user-owned custom specification for the normalized symbol + asset type.
2. A built-in system specification for supported futures contracts.
3. Standard system defaults for options (100 multiplier) and non-derivative assets (1 multiplier).

If a normalized broker execution already includes an explicit positive broker multiplier, that broker value is preserved. An unknown futures contract is **not** silently assigned multiplier 1; it must be resolved by a built-in or user-owned specification before persistence/reconstruction.

## Built-in futures

The initial system catalog includes ES, MES, NQ, MNQ, YM, MYM, RTY, M2K, CL, MCL, GC, MGC, SI, SIL, HG, NG, ZB, and ZN.

Examples:

| Symbol | Tick size | Tick value | Point value | Multiplier |
| --- | ---: | ---: | ---: | ---: |
| ES | 0.25 | $12.50 | $50.00 | 50 |
| MES | 0.25 | $1.25 | $5.00 | 5 |

Futures contract months such as `/ESZ26` normalize to the root `ES` for specification lookup.

## Integration points

- Thinkorswim CSV execution import: normalized executions are enriched before the execution ledger is written.
- Broker API synchronization: normalized executions use the same enrichment path before persistence and reconstruction.
- Manual trade creation/update: the service resolves a multiplier when one is not already persisted/provided.
- Existing historical trades: already-persisted positive multipliers are preserved, so Phase 3 does not retroactively rewrite historical P&L.
- Risk: existing risk calculations consume the canonical trade financials; the multiplier is resolved before those financials are persisted.
- Replay / Backtesting: future market-data and execution engines should call this service rather than introduce symbol-specific multiplier tables.

## Custom specifications

`InstrumentSpecification` is user-owned and protected by the existing authentication/ownership middleware. Custom entries can define:

- symbol
- asset type
- tick size
- tick value
- point value
- contract multiplier
- currency
- exchange
- timezone
- session metadata

A user may have at most one custom specification for a symbol + asset type. Different users may independently define their own overrides.

## Financial correctness boundary

The authoritative financial formula remains in `calculationsService`. Phase 3 only centralizes how a trade/execution obtains its multiplier. This preserves the deterministic calculation path introduced in Phase 2.
