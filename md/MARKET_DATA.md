# Historical market-data contract (Phase 4)

This is a local-file infrastructure release. It does not supply or generate market prices. Obtain historical data you are entitled to use and supply its actual calendar and metadata. Test CSVs are artificial fixtures, never production seed data.

## Enable a local catalog

Use Node 22.23.2 (`nvm install && nvm use`). Set these in `server/.env` and restart the server:

```dotenv
MARKET_DATA_PROVIDER=local-csv
MARKET_DATA_LOCAL_ROOT=/absolute/path/to/private/market-data
```

Without these settings, historical data stays explicitly unconfigured. Unknown provider names are not treated as implemented providers.

Find the intended user's ID through the authenticated `GET /api/auth/me` response (`user.id`). A server operator places files in:

```text
/absolute/path/to/private/market-data/
  <lowercase-user-object-id>/
    manifest.json
    aapl-minute.csv
```

These are server-managed files, outside public uploads. Do not use another user's ID, share directories through symlinks, or expose this directory through a static file server. There is no file-upload UI or arbitrary file-path API. ROOT and ADMIN cannot access another user's catalog through the API. Back up these files separately; MongoDB backup/restore does not include local historical files.

## Manifest format

The following is an illustrative calendar definition, not an authoritative exchange calendar. Replace its dates/windows and metadata with those applicable to your source. Prices are deliberately omitted.

```json
{
  "version": 1,
  "datasets": [{
    "id": "aapl-minute",
    "symbol": "AAPL",
    "timeframe": "1m",
    "assetType": "equity",
    "file": "aapl-minute.csv",
    "timezone": "America/New_York",
    "timestampFormat": "offset",
    "timestampConvention": "start",
    "priceBasis": "unadjusted",
    "calendar": {
      "from": "2026-03-09T00:00:00Z",
      "to": "2026-03-10T00:00:00Z",
      "timestampFormat": "local",
      "sessions": [{
        "tradingDate": "2026-03-09",
        "kind": "rth",
        "start": "2026-03-09T09:30:00",
        "end": "2026-03-09T16:00:00"
      }]
    }
  }]
}
```

- Dataset IDs are unique per owner. If multiple datasets match a symbol/timeframe, requests must include `datasetId`; there is no automatic choice between adjusted/unadjusted files.
- Supported timeframes: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`. A timeframe is supported for a symbol only when explicitly supplied as a dataset. No resampling occurs.
- Asset types: `equity`, `future`, `option`, `forex`, `crypto`. Contract metadata comes from the existing owner-scoped instrument specification service, not a second contract database. Unknown specifications produce `contractMetadata: null` and `CONTRACT_METADATA_UNAVAILABLE`.
- Symbols are trimmed and uppercased, preserving expiry and separators. `/ESU26`, `ESU26`, and `ES` remain distinct identifiers. No roll rules, continuous-contract stitching, adjustment factors, or symbol alias guesses are applied.
- `priceBasis` is explicitly `unadjusted` or `adjusted`. The service preserves source prices; it does not perform corporate-action or futures-roll adjustments.
- File paths are relative to the owner's directory. Absolute paths, traversal, symlink escapes, and non-regular files are rejected. An owner directory itself cannot be a symlink.
- Publish changes by writing complete temporary files and atomically renaming them into place. Changes detected during reading return `MARKET_DATA_SOURCE_CHANGED`; retry after publication completes. File metadata revisions invalidate cached candles on subsequent requests.

## CSV and canonical candles

Required header (volume is optional):

```csv
timestamp,open,high,low,close,volume
```

Use comma-delimited CSV with exactly these columns, finite decimal prices, and nonnegative volume if known. Missing volume becomes `null`, not zero. Negative and zero prices are permitted because the service does not impose a positive-price assumption on every asset. OHLC must satisfy `low <= open,close <= high`.

Each canonical candle contains:

```text
symbol, timeframe, timestamp, open, high, low, close, volume,
timezone, session, tradingDate
```

`timestamp` is an ISO UTC string with millisecond precision and identifies the **start** of a source bar. `timezone` retains the declared IANA exchange/source zone. Numeric values are not rounded, converted into another currency, or otherwise adjusted.

For `timestampFormat: "offset"`, source timestamps must include seconds and `Z` or `±HH:mm`. For `"local"`, timestamps must use `YYYY-MM-DDTHH:mm:ss[.SSS]` without an offset, and are interpreted in the declared IANA timezone. Ambiguous autumn times and nonexistent spring times are rejected; supply explicit-offset source timestamps instead. Date-only strings, implicit machine-local timestamps, numeric epochs, malformed dates, leap seconds, and sub-millisecond values are rejected. Request boundaries and calendar coverage always require explicit offsets (or Date objects for internal callers).

Timezone handling uses [Temporal's explicit disambiguation semantics](https://tc39.es/proposal-temporal/docs/zoneddatetime.html) through the [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill). No global Date behavior is modified. Reproducibility across deployments also requires compatible Node/ICU timezone data; historical government timezone-rule changes can alter local-time interpretation. Offset-stamped sources avoid ambiguity.

## Calendars, sessions, and gaps

Calendar coverage and all requests are half-open `[from,to)`. Coverage is an explicit assertion that every trading window within that interval is listed. Unlisted periods within coverage are closed; periods outside coverage are unknown and cause `MARKET_DATA_RANGE_UNAVAILABLE`.

Session kinds are `premarket`, `rth`, `postmarket`, and `eth`. Supply non-overlapping intervals, including early closes and breaks. A futures overnight interval may begin the previous local date while carrying the next `tradingDate`. Multiple segments may share that trading date, but trading dates must follow chronological session order. Session times can use a different timestamp format from CSV rows. No built-in holiday calendar or standard session schedule is silently applied.

Intraday starts are `session.start + n * timeframe`, before `session.end`. A final partial-duration bar is permitted at a session close; no candle is synthesized for it. Source bars must match this declared grid. Daily bars are supplied aggregates, one per `tradingDate`, timestamped at the first listed session open. They are not aggregated by the service. Daily requests do not support filtering their constituent sessions.

Rows are normalized, sorted, and validated before caching. Identical duplicates collapse with an explicit warning; conflicting OHLC or volume at the same timestamp fails. Off-grid/out-of-session rows fail. Missing bars are detected against the declared calendar, including leading and trailing gaps. Validation covers the entire source file, not just the requested subrange.

## Protected API

All endpoints use existing session authentication. Ownership comes exclusively from `req.user.id`; client `userId`, file paths, or roles cannot select another owner. HTTP responses are `Cache-Control: no-store`.

- `GET /api/market-data/status`: `{ configured, provider, state }`. Configured means the adapter is selected and has its required root setting, not that any particular file or range is available.
- `GET /api/market-data/datasets`: `{ datasets: [...] }`, owned metadata and calendars without filesystem paths.
- `GET /api/market-data/candles?symbol=AAPL&timeframe=1m&from=2026-03-09T13:30:00Z&to=2026-03-09T14:00:00Z`: canonical range result. Optional `datasetId` and `session=all|rth|premarket|postmarket|eth`.

Range result:

```text
{
  state, candles,
  request: { symbol, timeframe, from, to, session },
  dataset: { id, provider, revision, assetType, timezone, priceBasis, timestampConvention },
  contractMetadata,
  diagnostics: { expectedBars, actualBars, missingBars, missingTimestamps, warnings }
}
```

| State | Meaning |
| --- | --- |
| `available` | Every expected start in the requested range has a candle. |
| `partial` | Some expected starts have no candle; available candles are returned unchanged. |
| `unavailable` | The calendar expects bars but none were supplied. |
| `closed` | No selected session overlaps this covered range. |
| `empty` | A selected session overlaps, but the range includes no bar starts. |

These explicit states use HTTP 200. Invalid data, unsupported selections, unknown datasets, and provider failures use errors shaped as `{ error: { code, message, details?, requestId? } }`. Common codes include `MARKET_DATA_UNAVAILABLE` (404), `MARKET_DATA_UNSUPPORTED_TIMEFRAME` (400), `MARKET_DATA_INVALID_TIMESTAMP` (422), `MARKET_DATA_CONFLICTING_DUPLICATE` (422), `MARKET_DATA_INVALID_CANDLE` (422), `MARKET_DATA_RANGE_UNAVAILABLE` (422), `MARKET_DATA_NOT_CONFIGURED` (503), and `MARKET_DATA_PROVIDER_ERROR` (503). Provider failures never return local paths or credentials.

## Consumer and adapter contracts

Existing exports `getProviderName()`, `isConfigured()`, and `fetchCandles()` remain. `getCandles({ userId, symbol, timeframe, from, to, datasetId?, session? })` is the canonical future Replay/Backtesting contract.

`fetchCandles()` is the strict legacy wrapper: it requires an available, non-empty range and adds `time: timestamp` for the existing SMA engine. It accepts an optional `requireContractMultiplier` precondition. Current Backtesting requires exactly `1`, because its existing engine does not apply contract multipliers. Futures/options/non-unit custom specifications and unknown metadata therefore fail explicitly rather than producing misleading P&L. The canonical API supports those instruments and exposes their metadata. Existing saved configurations and simulation calculations are unchanged. DateTo remains an explicit exclusive boundary; no extra day is silently appended.

`MarketDataProvider` defines symbol/timestamp normalization, `listDatasets(userId)`, `describe(request)`, `fetchCandles(description)`, calendar/session access, and contract metadata lookup. The local adapter returns raw CSV rows. Any future vendor adapter must return equivalent metadata and rows into the same shared normalizer; controllers and simulation engines never import vendor adapters. `describe()` must enforce ownership and supply a stable revision that changes when source values or metadata change. Its source handle is private to the adapter. Wire a future adapter in the service factory, not across consumers.

## Cache and limits

Pipeline: provider → normalizer → bounded canonical-candle cache → range selection → consumers.

The process-local LRU caches validated source candles, so identical and overlapping ranges avoid repeated CSV reads/parsing. Keys include owner, provider, dataset, source revision, and normalization version. Same-key concurrent loads coalesce; returned objects are cloned, failures are not cached, and source metadata is checked on every request. Contract specifications are resolved per request so owner changes are not hidden by the candle cache.

Defaults: 32 entries, 32 MiB serialized values, five-minute TTL, four concurrent source loads. Up to 100 datasets per owner, 1 MiB manifest, 16 MiB CSV, 8 KiB CSV row, 100,000 source rows/expected bars, and 10,000 session intervals per dataset. Calendars exceeding the bar limit must be partitioned into smaller datasets; select their dataset IDs explicitly. Catalog reading, range selection, and response cloning still take work on cache hits. Each server process has its own cache; there is no persistent/distributed cache in this phase.

No database migration is required. Local files are not imported into MongoDB. Replay continues to show recorded fills, with its disclosure visible even when historical data is configured. No new replay interface, strategy engine, backtest fill model, or AI behavior was implemented.
