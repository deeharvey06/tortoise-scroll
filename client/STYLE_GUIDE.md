# Frontend style guide

Use function components and hooks. Optimize for readable feature boundaries and explicit data flow, following the existing ESLint and Prettier configurations.

## Imports and links

- Use `@/` for every local source import, including lazy imports, re-exports and test mocks. Vite and `jsconfig.json` resolve it to `src/`; ESLint rejects relative static imports.
- Define application URLs in `src/config/routes.js`. Use the same constants in the router, sidebar, redirects and buttons. Use URL builders for IDs and query parameters so values are encoded correctly.
- Keep API URLs in service modules. Server-provided search links remain server data; do not duplicate the server's route selection in the UI.

## Components and external libraries

- Pages compose feature components and hooks. Extract a component when a section has its own responsibility or is repeated, rather than imposing a line limit.
- Put feature-only components and hooks under that feature's page directory. Shared hooks, UI and chart components live in `src/hooks` and `src/components`.
- Wrap external components where the app owns behavior or visual conventions. Use `Panel`, `MetricCard`, `ErrorState`, `LoadingState`, the chart components, `AppThemeProvider` and `QueryProvider` instead of rebuilding those integrations. A wrapper should expose application concepts such as `data`, not an entire vendor API. MUI layout and typography primitives can be used directly.
- Keep `sx` styles next to their component. Share chart styles within the chart directory. Global SCSS is for resets, tokens and genuinely global utilities.
- Use descriptive names for callbacks and mapped items; avoid nested ternaries when a named value or small component communicates the decision better.

## Data and business logic

- Service functions own HTTP calls. Domain hooks own queries, mutations and workflow state. Pure utilities own transformations such as strategy labels. Components render values and forward user actions.
- Use TanStack Query in domain hooks for server reads. Include every input that changes the response in the query key; forward its AbortSignal to services. Do not duplicate query data, loading or errors in local state.
- Use event handlers or mutation hooks for user-triggered writes and explicit calculations. Invalidate affected queries after a successful write. Keep controlled input state local and use Zustand for shared client preferences.
- Each authenticated session gets its own query provider. Current queries use zero stale/garbage-collection times while legacy mutations are migrated; revisit longer caching only after mutation invalidation is complete.
- Compute filtered rows, labels, booleans and result visibility during render. Use `useMemo` only for costly computations or required referential stability.
- Keep loaded content mounted during refreshes and show `RefreshStatus` in its reserved space. Legacy state-based lists use `useInitialLoading` to limit skeletons to their first load, including empty results. Query hooks may retain previous filter results while fetching; do not retain data across different report schemas or editable record identities. Keep each search request owned by one effect after debouncing.
- Do not use effects to handle clicks, save forms, copy props into state or calculate derived values. Reset form state through explicit open/reset events or a keyed form component when its identity changes.
- Effects are appropriate for synchronization with external systems, such as timers, document theme attributes, chart subscriptions and playback. Clean up what you subscribe to. Do not suppress dependency warnings to control fetching.

## Reference implementations and migration status

Dashboard, Reports, Analytics, methodology comparisons, global search, filter options and API health now use domain hooks. Reports and Dashboard demonstrate small composed sections; charts wrap Recharts with local styling. Session initialization runs once at the application entry point.

Absolute imports and centralized frontend navigation apply across the client. Other legacy feature pages still contain fetch effects and large components (for example Trades, Accounts, Knowledge, Settings, Replay and Backtesting). Migrate those feature by feature using the conventions above; this refactor does not claim that every legacy page is already compliant.

## Verification

Run `npm run lint --prefix client`, `npm test --prefix client`, and `npm run build --prefix client`. Tests use `src/test/render.jsx` for an isolated query provider. Exercise stale requests, changed inputs, errors, session changes and user behavior rather than asserting hook implementation details.

References: [React effect guidance](https://react.dev/learn/you-might-not-need-an-effect) and [TanStack Query](https://tanstack.com/query/v5/docs/framework/react/overview).
