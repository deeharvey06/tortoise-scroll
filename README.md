# Trading Journal (Local-First) — Complete (Phases 1–8)

A personal, local-first trading journal inspired by TradeZella's feature set,
built with an independent codebase (no TradeZella source, assets, or IP).
Built in phases. **Phase 1**: scaffolding, DB connection, Trade CRUD, app
shell. **Phase 2**: CSV import, trade table, trade detail (journal/tags/
screenshots), journal/notebook. **Phase 3**: Dashboard, Calendar, Analytics,
Reports, global filter bar. **Phase 4**: Strategies, Playbooks, live Risk
dashboard. **Phase 5**: Trade Replay, unit-tested Backtesting engine.
**Phase 6**: AI Trading Partner chat, grounded in real trade data. **Phase
7**: the five autonomous agents. **Phase 8** (this update, the final phase):
performance work, expanded testing, backup/restore, and the completed
Settings page.

**Phase 8 in detail:**
- **Performance:** added missing MongoDB indexes across every model (import
  jobs, AI conversations/memories, tagging rules, backtest configs,
  strategies, playbooks, accounts — Trade already had its compound indexes
  from Phase 1). Converted every page route to `React.lazy` + `Suspense`
  code-splitting, so pages like Dashboard/Analytics/Backtesting (which pull
  in Recharts) only load their JS when actually visited. Memoized `KpiCard`,
  the most-repeated component in the app. **Known, documented limitation:**
  the analytics/reports/AI-context engine still computes in Node from
  fetched documents rather than MongoDB aggregation pipelines — correct and
  fast at personal-journal scale (tested with the seed script's 1,000
  trades), but a genuine rewrite would be needed for 100k+ trade datasets.
  I did not attempt that rewrite this phase: it's the single most
  load-bearing calculation path in the app, and rewriting it wholesale
  without the ability to run it against a real MongoDB in this environment
  would risk introducing a silent correctness bug in exactly the code
  everything else depends on. That's a judgment call, not an oversight —
  documented here so it's a decision you can revisit, not a gap you'd
  discover by surprise.
- **Testing:** added `analyticsService.test.js` (12 tests) — this was a real
  gap: the analytics engine had only been manually spot-checked in earlier
  phases, never given a permanent test file, despite being the most-used
  calculation path in the app. Total test count is now **38** across 6 test
  files (calculations, analytics, backtest engine, prompt builder,
  auto-tagger rules, performance patterns) — all pure-function tests with
  no database dependency, runnable anywhere.
- **Backup/restore:** full JSON database export (every collection except
  raw uploaded image files and your OpenAI API key) and a guarded restore
  flow with an explicit confirmation dialog before anything is overwritten.
  Also documented `mongodump`/`mongorestore` for a complete binary backup.
- **Settings, finally real:** General (timezone, currency, default
  account), Trading (default risk/R/strategy), Tags (manage the tag catalog
  by category), AI (links to the AI Trading Partner page, where those
  settings already lived), and Data (backup/restore + CSV export).
- **Seed data:** `npm run seed` was referenced in `package.json` since
  Phase 1 but the script itself was never written until now — a genuine
  gap, now fixed. Generates 3 accounts, ~1,000 trades, 10 strategies, 30
  tags, and 60 journal entries, all clearly marked as demo data (prefixed
  `[DEMO]` or flagged `isDemoData: true`) and safely re-runnable.
- **Polish:** tooltips on icon-only buttons, two keyboard shortcuts on the
  Trades page (`/` to search, `n` for a new trade).

## Stack

- **Client:** React 18 + Vite, MUI, SCSS modules, Recharts (added later),
  Axios, React Hook Form, date-fns, Zustand
- **Server:** Node.js + Express, MongoDB + Mongoose, dotenv, cors, multer
  (screenshots + CSV upload), csv-parser, decimal.js for money-safe math
- **AI:** not yet wired (Phase 6) — the abstraction layer will support
  OpenAI and a local Ollama model, and the app works fully without either.

## Prerequisites

- Node.js 18+
- MongoDB running locally (Community Edition). Install via Homebrew on macOS:

  ```bash
  brew tap mongodb/brew
  brew install mongodb-community
  brew services start mongodb-community
  ```

  Verify it's running: `mongosh` should connect without error.

## Setup

```bash
# from the project root
cp server/.env.example server/.env
npm run install:all
```

`install:all` runs `npm install` in both `server/` and `client/`.

## Run (both client and server together)

```bash
npm run dev
```

This starts:
- API at **http://localhost:5050**
- Client at **http://localhost:5173** (Vite proxies `/api` to the server)

Or run them separately in two terminals:

```bash
npm run dev:server   # http://localhost:5050
npm run dev:client   # http://localhost:5173
```

## Verifying Phase 1 works

Walk through these in order. If any step fails, fix it before moving to
Phase 2 — that's the process defined for this build.

1. **MongoDB is up:** `mongosh mongodb://localhost:27017` connects cleanly.
2. **API boots and connects to Mongo:** run `npm run dev:server`. You should
   see:
   ```
   [db] Connected to MongoDB at mongodb://localhost:27017/trading-journal
   [server] Trading journal API listening on http://localhost:5050
   ```
3. **Health check:** `curl http://localhost:5050/api/health` returns
   `{"status":"ok","timestamp":"..."}`.
4. **Account CRUD works:**
   ```bash
   curl -X POST http://localhost:5050/api/accounts \
     -H "Content-Type: application/json" \
     -d '{"name":"Main Account","broker":"IBKR","currency":"USD","startingBalance":25000}'
   curl http://localhost:5050/api/accounts
   ```
5. **Trade CRUD works end-to-end.** Copy an `_id` from step 4, then:
   ```bash
   curl -X POST http://localhost:5050/api/trades \
     -H "Content-Type: application/json" \
     -d '{
       "accountId": "PASTE_ACCOUNT_ID",
       "symbol": "AAPL",
       "direction": "long",
       "quantity": 100,
       "entryPrice": 190.00,
       "exitPrice": 191.50,
       "entryTime": "2026-08-20T14:30:00Z",
       "exitTime": "2026-08-20T14:45:00Z",
       "riskAmount": 100,
       "fees": 1,
       "commission": 2,
       "setup": "Breakout",
       "session": "open"
     }'
   ```
   The response should include computed `grossPnL: 150`, `netPnL: 147`, and
   `rMultiple: 1.47` — these are calculated server-side by
   `server/src/services/calculationsService.js`, never hardcoded.
6. **List/paginate:** `curl "http://localhost:5050/api/trades?page=1&limit=25"`
   returns `{ items: [...], pagination: {...} }`.
7. **Client loads:** open http://localhost:5173. The sidebar shows all 14
   nav items. The top bar shows an "API connected" chip (green) once the
   server is reachable.
8. **Trades page is fully functional:** go to **Trades**. Create an account
   from the UI if you haven't via curl, click **New trade**, fill the form,
   save, and confirm the row appears with correct Net P&L / R coloring
   (green for profit, red for loss). Edit it, then delete it with the
   confirmation dialog.
9. **Placeholder pages are honest:** every other nav item renders a page
   stating which phase it ships in — none of them show fake numbers or
   charts.

## Verifying Phase 2 works

Phase 2 adds CSV import, an enhanced trade table, trade detail (journal /
tags / screenshots), and the journal notebook. Walk through these against
your already-running `npm run dev`:

1. **CSV import, generic adapter:**
   - Go to **Import**. Leave broker as "Generic CSV".
   - Create a small test file, e.g. `test-trades.csv`:
     ```csv
     Ticker,Side,Shares,In,Out,Opened,Closed
     AAPL,long,100,190.00,191.50,2026-08-20 14:30,2026-08-20 14:45
     TSLA,short,50,250.00,248.00,2026-08-21 10:00,2026-08-21 10:20
     BADROW,sideways,10,,,2026-08-22 09:30,
     ```
   - Drag it in (or use the file picker), click **Preview**.
   - On the mapping step, map Symbol→Ticker, Direction→Side, Quantity→Shares,
     Entry price→In, Exit price→Out, Entry time→Opened, Exit time→Closed.
     Continue.
   - Pick the account to import into, review the interpreted preview rows,
     click **Import**.
   - Confirm the result screen shows **2 imported, 0 duplicates, 1 error**
     (the `BADROW` row — unrecognized direction and missing entry price —
     with both reasons listed, not silently dropped).
   - Re-run the same import against the same file: this time all rows should
     report as **duplicates**, proving the row-hash duplicate detection
     works.
2. **Trade table enhancements:** go to **Trades**.
   - Type in the search box (e.g. "AAPL") and confirm the list filters after
     a short debounce.
   - Select two or more rows via the checkboxes; confirm the bulk toolbar
     appears with **Add tags** and **Delete**. Try bulk-tagging, confirm the
     tags show up on the rows.
   - Click **Export CSV** and confirm a file downloads with the current
     filtered set.
   - Click a trade's date or symbol (not the edit/delete icons) and confirm
     it navigates to `/trades/:id`.
3. **Trade detail page:**
   - Confirm Summary/Execution sections show correct entry/exit/P&L/R/
     duration.
   - Edit entry reasoning, add a mistake and an emotion tag, set a
     confidence rating, check "Followed plan", add a tag, click
     **Save journal** — reload the page and confirm everything persisted.
   - Upload a screenshot (any small image). Confirm it renders, add a
     caption and click away to save it, then delete it and confirm both the
     UI and (if you check `server/uploads/screenshots`) the file on disk are
     gone.
4. **Journal / notebook:** go to **Journal**.
   - Click **+ Pre-Market Plan**, fill in a few fields, save. Confirm it
     appears in the list with the "Pre-Market Plan" chip and a text preview.
   - Click **+ Post-Market Review**, same check.
   - Click **New entry**, choose "Daily Journal", write free text, save.
   - Filter the list by type using the dropdown and confirm it narrows
     correctly. Edit and delete an entry.
5. **Tag catalog:** any tag you add via a trade's tag field or a journal
   entry becomes available for autocomplete on the next trade you tag — this
   confirms `POST /api/tags` upserts are working and the catalog is shared
   across trades.

## Verifying Phase 3 works

Phase 3 adds real aggregation. It reuses whatever trades you already have
from Phase 1/2 testing — the more trades (with a mix of wins/losses/setups/
sessions across a few different days), the more interesting these will look,
but even 2-3 closed trades are enough to confirm the math is right.

1. **Global filter bar:** at the top of every page, confirm you can change
   the date preset (Today / This week / This month / etc.), and that
   choosing **Custom range** reveals From/To date pickers. Open **Filters**
   and set an Account, Symbol, or Setup — confirm a chip appears and an
   active-filter count shows on the Filters button. Click **Clear** and
   confirm everything resets.
2. **Dashboard:**
   - Go to **Dashboard**. With filters cleared (All time), confirm the KPI
     cards show real numbers matching what you'd hand-calculate from your
     trades (e.g. Net P&L = sum of each trade's `netPnL`).
   - Cross-check one figure by hand: pick 2-3 known trades, sum their
     `netPnL` from the Trades page, and confirm it matches "Net P&L" here
     when filtered to just those (e.g. by symbol).
   - Confirm the Equity Curve chart is monotonically consistent with your
     trade sequence (each point should be the previous point plus that
     trade's net P&L), and the Drawdown chart never goes positive.
   - Change the date range to something that excludes all your trades and
     confirm you get the "No trades match the current filters" message
     instead of a broken chart.
3. **Calendar:**
   - Go to **Calendar**. Confirm days with trades are shaded green (net
     profit) or red (net loss), with darker shading for larger P&L.
   - Click a shaded day and confirm the dialog shows the correct day's
     trades, matching what you'd see filtering the Trades page to that date.
   - Navigate to a previous/next month with the arrows and confirm it
     refetches correctly (network tab should show a new `/api/analytics/
     calendar?year=...&month=...` call).
4. **Analytics:** go to **Analytics** and confirm the by-symbol/setup/
   session/direction/day-of-week/hour tables show trade counts, win rates,
   and net P&L that are internally consistent (the counts across all rows
   in one table should sum to your total closed-trade count for that
   dimension).
5. **Reports:** go to **Reports**.
   - **Performance** tab: KPI cards should match the Dashboard's numbers
     exactly (same underlying calculation).
   - **Execution** tab: confirm it shows entry-timing-by-hour and holding
     time stats, and the info banner honestly states that early-exit/
     late-entry detection needs Phase 4 (Strategies/Playbooks) to define a
     "plan" to compare against.
   - **Behavior** tab: if you've tagged any trades with a mistake or emotion
     (Phase 2's Trade Detail page), confirm they show up here with a count
     and average P&L. If you have fewer than 10 trades after 2+ consecutive
     losses, confirm you see the small-sample-size warning rather than a
     confident claim.
   - **Market** tab: cross-check the "By session" and "By direction" tables
     against trades you know the session/direction of.

## Verifying Phase 4 works

1. **Strategies:**
   - Go to **Strategies**, click **New strategy**, fill in name/entry rules/
     exit rules/etc., save. Confirm it appears in the left list.
   - Upload a reference screenshot and confirm it renders; delete it and
     confirm it's gone.
   - Go to **Trades**, edit (or create) a trade, and confirm the new
     **Strategy** dropdown lists the strategy you just created. Assign it
     and save.
   - Back on **Strategies**, select that strategy and confirm the
     performance KPI cards (Net P&L, Win rate, Profit factor, Expectancy,
     Avg R, Trades, Avg winner/loser, Max drawdown) now reflect that one
     trade, and match what you'd expect from its numbers.
   - Try deleting a strategy that has a trade assigned — confirm you get a
     409 error telling you to reassign trades first, not a silent failure
     or an orphaned reference.
2. **Playbooks:**
   - Same flow: create a playbook, fill in entry/exit criteria, assign a
     trade to it from the Trade form, confirm its performance panel
     updates.
   - Check off a few items in the **pre-trade checklist** panel and confirm
     the "checked/total" count updates; switch to a different playbook and
     confirm the checklist resets (it's a per-session aid, not persisted
     state).
3. **Risk dashboard:**
   - Go to **Risk**. With no limits configured, confirm the KPI cards still
     show real numbers (today's P&L, current drawdown, consecutive losses,
     etc.) computed from your trade log — the "no limits configured" message
     should appear only in the limits-bar panel, not block the KPIs.
   - Set a **Max daily loss** to something small (e.g. $50) and save. If
     today's closed-trade P&L is already past -$50 (or -80% of it), confirm
     a warning banner appears at the top and the usage bar goes red/amber.
   - Select a specific account in the global filter bar and confirm the
     Risk page switches to that account's limits (or falls back to global
     limits if you haven't set account-specific ones) and its own P&L/
     exposure figures.

## Verifying Phase 5 works

1. **Backtest engine unit tests (the important one):**
   ```bash
   cd server
   npm test
   ```
   Confirm `backtestEngine.test.js` passes all 5 tests: a profitable SMA
   crossover round-trip, a stop-loss that correctly caps the loss using the
   bar's low (not the misleading close price after a gap), commission/
   slippage strictly reducing net P&L vs. a zero-cost run, a flat market
   producing zero trades with `null` (not `0`) summary stats, and an
   unsupported rule type throwing a clear error instead of silently
   no-opping.
2. **Replay:**
   - Go to **Replay**, pick a date you have at least one trade on, click
     **Load session**.
   - Step through with the forward/back buttons and the slider; confirm
     each trade's real entry/exit prices, P&L, and R show correctly.
   - Click Play and confirm it auto-advances at the selected speed, and
     stops at the last trade instead of looping or erroring.
   - Add a note and a tag to a trade, click **Save**, then reload the
     session and confirm it persisted (this is a real write to the same
     Trade document Phase 2's Trade Detail page edits).
   - Confirm the info banner about no market-data provider appears, and
     that the chart only plots real points (no smooth candlestick-looking
     price path).
3. **Backtesting:**
   - Go to **Backtesting**. Confirm the "no market-data provider connected"
     banner appears, and the Run button is disabled with a tooltip
     explaining why (hover to check).
   - Click **New backtest**, fill in a symbol, SMA periods, date range,
     stop/target/commission/slippage, save. Confirm it appears in the
     table and can be edited and deleted.
   - Try deleting it and confirm it's removed.
   - (Optional, advanced) If you want to see the engine actually run end to
     end, you'd need to implement a real provider in
     `marketDataService.js` and set `MARKET_DATA_PROVIDER` — not expected
     for this phase, just confirming the gate works as designed: with no
     provider, attempting to hit `POST /api/backtest/configs/:id/run`
     directly (e.g. via curl) should return a `501` with a clear message,
     not a crash or fabricated result.

## Verifying Phase 6 works

1. **Prompt builder unit tests:**
   ```bash
   cd server
   npm test
   ```
   Confirm `promptBuilder.test.js` passes all 4 tests, and the full suite is
   now 5 (calculations) + 5 (backtest engine) + 4 (prompt builder) = 14.
2. **AI disabled by default:** go to **AI Trading Partner**. Confirm you
   see "AI is not configured yet" and the settings panel is already open.
   Confirm the chat input is disabled with a tooltip, but the rest of the
   page (memories panel) still works.
3. **Configure a provider.** You'll need either an OpenAI API key or a
   local Ollama instance running (`ollama serve`, with a model pulled, e.g.
   `ollama pull llama3.1`).
   - Pick a provider, fill in the fields, click **Save AI settings**.
   - Confirm the "not configured" banner disappears and the chat input
     enables — no server restart needed.
4. **Ask a grounded question.** With a few closed trades logged, ask "What
   is my best setup?" or "Am I more profitable long or short?".
   - Confirm the reply cites actual numbers and a sample size (e.g. "2 of 3
     trades," not a vague "you seem to do well").
   - Cross-check one number against the Dashboard — it should match
     exactly, since both come from the same `analyticsService`.
   - Ask something the data can't answer (e.g. about a symbol you've never
     traded) and confirm it says it doesn't have that data rather than
     inventing an answer.
5. **Memory:** type "remember that I should size down after two red days"
   into chat. Confirm it's saved to the Memories panel automatically (no
   extra step), and that asking a follow-up question in the same or a new
   conversation still has access to it — the system prompt includes all
   saved memories on every turn.
6. **Conversations:** start a second conversation with **+**, confirm the
   two are listed separately and switching between them shows the right
   history. Delete one and confirm it's gone from the list.
7. **Disable again:** set the provider back to "Disabled" and save. Confirm
   the chat input disables again and the rest of the app is unaffected —
   this is the default state and must always work.

## Verifying Phase 7 works

1. **Agent unit tests:**
   ```bash
   cd server
   npm test
   ```
   Confirm `autoTaggerAgent.test.js` (6 tests) and `performanceAgent.test.js`
   (6 tests) pass. Running total: 5 + 5 + 4 + 6 + 6 = 26 tests.
2. **Auto Trade Tagger:** go to **AI Trading Partner → Agents → Auto Trade
   Tagger**.
   - Create a rule, e.g. field `setup` equals `Breakout`, tags
     `high-conviction`, auto-apply **off**. Save.
   - Set a date range covering some existing trades with that setup, click
     **Run**. Confirm matching trades appear as suggestions (not already
     tagged), and clicking **Approve** actually adds the tag — verify on
     the Trades page.
   - Create a second rule with auto-apply **on**, run again, and confirm
     matching trades get tagged immediately with no approval step.
3. **Session Review:** pick a date you have trades on, click **Generate
   review**. Confirm it correctly identifies your best/worst trade for that
   day and any mistake tags you'd applied, and that the "no trades" case
   (pick an empty date) is handled gracefully rather than erroring.
4. **Pre-Market Briefing:** click **Generate briefing**. Confirm the first
   line always states no real-time market data is connected, and that the
   rest reflects your actual recent performance, active strategies, and
   configured risk limits.
5. **Risk Monitor:** click **Check risk now**. If you set a tight daily
   loss limit back in Phase 4 testing, confirm the same warning language
   appears here as on the Risk page — they should be word-for-word
   identical, since both now call `riskDashboardService.computeRiskDashboard`.
6. **Performance Patterns:** with fewer than 10 closed trades, confirm you
   get the explicit "not enough data yet" message rather than a forced
   pattern. With 10+, confirm any flagged pattern names its sample size and
   phrases tag-based findings as "an association... not a proven cause."
7. **AI narration toggle:** run any agent with AI disabled (plain bullet
   list should appear) and then again with AI configured (a narrated
   paragraph should appear above the same bullet list) — confirm the
   underlying findings text is identical either way; only presentation
   changes.

## Verifying Phase 8 works

1. **Full test suite:**
   ```bash
   cd server
   npm test
   ```
   Confirm all 38 tests pass across the 6 test files. The new
   `analyticsService.test.js` (12 tests) is the one that matters most this
   phase — it covers win rate, profit factor, expectancy, avg R, drawdown,
   equity curve, distributions, grouping, streaks, and tag breakdowns, all
   hand-verified against the actual `decimal.js` output before being
   written into assertions.
2. **Seed data:**
   ```bash
   cd server
   npm run seed
   ```
   Confirm it reports creating 3 accounts, 10 strategies, 30 tags, ~1,000
   trades, and 60 journal entries. Open the app and confirm:
   - The Dashboard/Analytics/Reports pages now show real charts and
     breakdowns instead of empty states.
   - Every seeded account name starts with `[DEMO]`, and every seeded trade
     has `isDemoData: true` (check via `mongosh`:
     `db.trades.countDocuments({isDemoData: true})`).
   - Re-run `npm run seed` and confirm it doesn't duplicate — it should
     clear its own previous demo data first (check the trade count stays
     roughly the same, not doubled).
3. **Lazy-loaded routes:** open DevTools → Network tab, hard-refresh the
   app on the Trades page, and note the JS bundles loaded. Navigate to
   Dashboard (or Analytics/Backtesting) for the first time in this session
   and confirm a new JS chunk loads at that moment — this confirms
   code-splitting is actually happening, not just configured.
4. **Backup export/restore:**
   - Go to **Settings → Data**, click **Export full database (JSON)**.
     Confirm a file downloads and open it — it should contain your real
     accounts/trades/etc., with `aiSettings.openaiApiKey` present but empty.
   - Click **Choose backup file to restore**, pick the file you just
     exported, and confirm the confirmation dialog appears before anything
     happens. Confirm it, and check the per-collection report shows counts
     matching what you exported.
   - Try uploading a clearly invalid JSON file (e.g. `{"foo": "bar"}`) and
     confirm you get a clear 400 error, not a crash or partial silent
     restore.
5. **Settings page:** visit each of the 5 tabs (General, Trading, Tags, AI,
   Data). Confirm General/Trading save correctly (change timezone, reload,
   confirm it persisted), Tags shows your tag catalog grouped by category
   with working add/delete, and the AI tab's link correctly navigates to
   the AI Trading Partner page.
6. **Polish:** on the Trades page, press `/` from anywhere on the page
   (not while typing) and confirm the search box focuses; press `n` and
   confirm the new-trade dialog opens (only when at least one account
   exists). Hover the edit/delete icons in the trade table and confirm
   tooltips appear.

## Browser E2E testing and the API smoke test

Every verification section above was written from API-level and unit-test
confidence — I never actually drove the app through a real browser myself
in this environment (no browser available in this sandbox). That's a real
gap for MVP acceptance, not a hypothetical one: it means things like "does
the equity curve chart actually render an SVG," "does clicking a calendar
day actually open the right trades," and "does the strategy dropdown in the
trade form actually list what was just created" were never confirmed
end-to-end. Two things now close that gap:

### `/e2e` — full browser E2E suite (Playwright)

Drives the exact sequence requested for MVP acceptance: create account →
import CSV → open a trade → add note/tag → add screenshot → create
strategy + playbook → assign to trade → inspect dashboard → use filters →
review calendar → create a pre-market plan → save risk settings → export
and restore data.

```bash
# one-time setup
npm run e2e:install

# make sure MongoDB is running, then:
npm run e2e            # headless
npm run e2e:headed     # watch it click through the app
```

Each `test()` in `e2e/tests/mvp-flow.spec.js` builds on state left by the
previous one and is annotated with what it's actually proving (e.g. test 08
asserts a real `<svg>` renders inside the equity curve chart container, not
just that the word "Equity curve" appears on the page). `e2e/tests/
helpers.js` handles MUI's menu-based `<Select>` components, which don't
behave like native `<select>` elements under Playwright.

**Two source fixes came directly out of writing this suite**, not from
separate review — writing real selectors is what surfaced them:
- Several icon-only buttons (edit/delete/upload icons across Trades,
  Strategies, Playbooks, Calendar, Journal, Backtesting, AI Trading
  Partner, Replay) had a `Tooltip` but no `aria-label`. A `Tooltip` sets
  `aria-describedby`, not `aria-label` — so these buttons had **no
  accessible name at all**, which is both an accessibility bug and the
  reason a naive `getByRole('button', { name: 'Edit' })` selector would
  have silently failed. Fixed by adding explicit `aria-label` to every one
  found.
- `KpiCard` and the Dashboard's `ChartSection` had no stable way to target
  a *specific* KPI or chart in a page full of them — I initially wrote
  fragile DOM-structure-guessing locators, caught it during review, and
  added a proper `data-testid` (`kpi-<slugified-label>`,
  `chart-<slugified-title>`) instead.

**What this suite does NOT cover:** Replay, Backtesting's run flow (gated
behind a market-data provider that doesn't exist), and the AI Trading
Partner chat/agents (gated behind an LLM provider) aren't included, since
they need external services this environment can't provide either. The 14
tests that exist cover every step from the requested MVP acceptance list.

**Important limitation on my end:** I wrote and syntax-checked every line
of this suite, hand-traced the logic that could be traced without a
browser (e.g. confirmed `formatCurrency(150)` really produces `"$150.00"`
before asserting on it), and fixed several bugs I found on review — but I
have not personally executed this suite, because this sandbox has no
browser and no network to install Playwright's browser binary. **You are
the first one to actually run it.** If a selector doesn't match on the
first run, that's expected-possible, not a sign the whole suite is
untrustworthy — run `npm run e2e:headed` to watch where it diverges from
what I assumed the UI would do.

### `server/scripts/apiSmokeTest.js` — fast CI gate, no browser needed

```bash
# with the server + MongoDB running:
npm run smoke --prefix server
```

Hits the core MVP API path directly (health check → create account →
create trade with computed P&L/R → dashboard analytics → calendar →
strategy/playbook creation and assignment → performance rollup → risk
settings → backup export → deletion and its 409 safety guards) in about a
second, and cleans up everything it created. This is what a CI pipeline
should run on every commit; the Playwright suite is slower and better
suited to pre-release checks. **This one I could reason through more
confidently** — it's plain HTTP requests with no DOM/rendering involved,
much closer to the API-level testing already covered in previous phases.

### A real gap this work found: Account had no PUT/DELETE

Auditing routes while writing the smoke test's cleanup step surfaced this:
`accountRoutes.js` had a code comment since Phase 1 promising "Expanded in
a later phase" — and no later phase ever added it. Accounts had only
`GET`/`POST`. Fixed now: `PUT /api/accounts/:id` and `DELETE /api/accounts/
:id`, the latter following the same 409-if-referenced-by-trades pattern as
Strategy/Playbook deletion. This is exactly the kind of gap that stays
invisible until someone tries to actually complete a real workflow.

## Running server tests

```bash
cd server
npm test
```

This runs `server/tests/calculationsService.test.js` against Node's built-in
test runner, covering: simple long/short P&L, decimal-safe rounding, R
multiple from an explicit risk amount, R multiple derived from stop-loss
distance when no risk amount is given, open trades correctly returning
`null` (not `0`) for P&L, and multi-fill execution aggregation.

## Project structure

```
/client         React + Vite app
  /src
    /layout     Sidebar, Topbar (hosts GlobalFilterBar), AppLayout shell
    /pages      One folder per nav destination
      /Trades   List (search/bulk/export) + TradeDetailPage + form dialog
                (form includes Strategy/Playbook assignment)
      /Journal  Journal list + pre-market/post-market templates
      /Import   CSV import wizard (upload -> map -> preview -> commit)
      /Dashboard  KPI cards + 9 charts (Recharts), filter-aware
      /Calendar   Month grid, color-coded by daily P&L, day drill-down
      /Analytics  By-symbol/setup/session/direction/day/hour breakdown tables
      /Reports    Performance / Execution / Behavior / Market tabs
      /Strategies List + rules editor + performance panel + screenshots
      /Playbooks  List + criteria editor + checklist + performance panel
      /Risk       Live dashboard + configurable limits with usage bars
      /Replay     Step/play through a session's real trades, annotate them
      /Backtesting  Saved SMA-crossover backtest configs; run when a
                    market-data provider is connected
      /AiPartner  Chat UI, provider settings, conversation list, memories,
                  and the Agents tab (all 5 agents)
      /Settings   General / Trading / Tags / AI (link) / Data (backup)
    /services   Axios API clients — one per backend domain (trade, journal,
                tag, import, analytics, reports, strategy, playbook, risk,
                replay, backtest, ai, agents, settings, backup)
    /store      Zustand: useUIStore (toasts), useFilterStore (global filter bar)
    /theme      MUI theme (dark, trading-terminal palette) — palette exported for charts
    /components Shared/reusable UI (KpiCard [memoized], GlobalFilterBar, PhasePlaceholder)
    router.jsx  Every page route is React.lazy + Suspense (code-split)
/server
  /src
    /config     DB connection
    /models     Trade, Account, Tag, JournalEntry, ImportJob, Strategy,
                Playbook, RiskSettings, BacktestConfig, AISettings,
                AIConversation, AIMemory, TaggingRule, AppSettings —
                indexed for their actual query patterns
    /controllers  Trade, account, import, journal, tag, screenshot,
                  analytics, reports, strategy, playbook, risk, replay,
                  backtest, ai, agents, appSettings, backup
    /routes     Express routers, incl. nested /trades/:id/screenshots and
                /strategies|playbooks/:id/images
    /engines    backtestEngine.js — pure simulation logic, zero Express/
                Mongoose dependencies, fully unit-tested in isolation
    /agents     autoTaggerAgent.js (pure rule matching), sessionReviewAgent.js,
                preMarketAgent.js, riskAgent.js, performanceAgent.js
                (pattern detection with sample-size gating), narrate.js
                (shared AI-narration-with-deterministic-fallback helper)
    /ai         providerClient.js (OpenAI/Ollama abstraction via fetch,
                no new deps), contextService.js (deterministic data bundle
                — the ONLY source of numbers the model sees), promptBuilder.js
                (encodes the AI safety rules into the system prompt)
    /services   calculations (per-trade), trade CRUD, CSV import, analytics
                (aggregation engine), performanceService (strategy/
                playbook), riskDashboardService (shared by Risk page + Risk
                Monitor agent), marketDataService (pluggable provider
                abstraction — no provider implemented yet)
    /middleware Async wrapper, centralized error handler, multer upload
                config (trade screenshots + strategy/playbook media)
    /utils      csvAdapters.js, hash.js, imageHandlers.js
  /uploads      Local screenshot/media storage (gitignored), served at /uploads
  /tests        38 tests across 6 files — calculations, analytics engine,
                backtest engine, prompt builder, auto-tagger rules,
                performance patterns. All pure functions, zero DB dependency.
  /scripts      seed.js (demo data) + apiSmokeTest.js (fast CI-gate check)
/e2e            Playwright browser E2E suite — the full MVP acceptance flow
                (see "Browser E2E testing" section above)
/docs           Architecture notes
```

## What's NOT built (honest final state)

Everything from the original spec has a real, working implementation
except:

- **A real market-data provider.** Replay and Backtesting are both built
  against a clean `marketDataService.js` abstraction, but no actual
  provider (Alpaca, Polygon, etc.) is implemented, since this app has no
  business fabricating historical price data to fill that gap. Wiring one
  in requires implementing `fetchCandles()` for it — no other code changes.
- **MongoDB aggregation pipelines for the analytics engine.** Everything
  computes correctly in Node from fetched documents (verified against
  1,000 seeded trades), but at genuinely large scale (100k+ trades) this
  would need rewriting as aggregation pipelines. Deliberately not attempted
  in Phase 8 — see the Phase 8 summary above for why.
- **Early-exit/late-entry detection** in the Execution report — needs a
  defined "plan" to compare actual execution against, which Strategies/
  Playbooks make possible but isn't wired up.
- **Trade Detail page** doesn't display the assigned strategy/playbook
  *name* (cosmetic only — the assignment itself is saved and used
  correctly in every calculation).
- **Scheduled/automatic agent runs.** The four analytical agents (Session
  Review, Pre-Market Briefing, Risk Monitor, Performance Patterns) are
  triggered manually from the Agents tab; there's no background job
  scheduler to run them automatically "after the trading day" or "before
  market open" as the spec's phrasing suggests.
- **React component tests and full API integration tests** (spec section 30
  also asks for these). What exists now: 38 pure-function unit tests
  (server), 14 browser E2E tests covering the full MVP path (Playwright,
  unexecuted by me — see the E2E section above), and 1 fast API smoke test
  script. Still missing: isolated component tests (Vitest + React Testing
  Library) for individual components in isolation, and deeper API
  integration tests using something like `mongodb-memory-server` +
  supertest that don't require a live MongoDB + running server the way the
  smoke test does.
- **The E2E suite itself is unexecuted.** I wrote it, syntax-checked it,
  hand-traced the logic I could trace without a browser, and fixed two real
  bugs it surfaced on review (missing `aria-label`s, fragile locators) —
  but this sandbox has no browser and no network to install one, so you are
  the first to actually run it. Treat the first run as a debugging pass,
  not a guaranteed-green pass.
- **No account edit/delete UI.** The backend now has full Account CRUD
  (`PUT`/`DELETE` added this pass), but the Trades page UI only exposes
  creating an account, not editing or deleting one — a real, still-open gap
  the API smoke test's cleanup step depends on but the UI doesn't expose.

Every one of these is a scoping decision made explicitly and documented
here — not a silent gap you'd find by accident.

## Data ownership

This is entirely local. Nothing leaves your machine unless you explicitly
configure an AI provider in a later phase. Backup is just your MongoDB data
directory (or `mongodump`) — no cloud account required, ever.
# tortoise-scroll
