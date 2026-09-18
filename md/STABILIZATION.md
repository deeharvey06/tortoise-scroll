# Phase 1 — Stabilization, Regression Testing & CI

This document defines the reproducible engineering baseline for Tortoise Scroll.
It does not add product functionality and it does not change authentication,
authorization, ownership, or financial behavior.

## Supported toolchain

- Node.js: 20.x LTS (the package manifests accept `>=20 <23`)
- npm: 10+
- MongoDB: 7.x recommended for CI/local integration testing
- Playwright Chromium for browser E2E

Use `nvm use` from the repository root when nvm is available.

## Clean installation

Do not distribute or rely on `node_modules` directories. From a clean checkout:

```bash
npm ci
npm run install:all
```

`install:all` uses each package's committed lockfile and installs server, client,
and E2E dependencies with `npm ci`.

## Local development

```bash
cp server/.env.example server/.env
npm run dev
```

The server's existing `predev` hook creates a strong local-only session secret
when the copied development value is blank/placeholder. Production remains
fail-closed and requires an explicitly managed secret.

## Quality gates

```bash
npm run lint
npm run test:server
npm run test:coverage
npm run test:client
npm run build:client
npm run e2e
```

Or run the non-browser local baseline in one command:

```bash
npm run ci:verify
```

### Source hygiene lint

The repository intentionally avoids introducing a new formatting/style migration
in this stabilization phase. `npm run lint` is a dependency-free source-hygiene
gate that checks JavaScript/JSX for unresolved merge markers, debugger statements,
trailing whitespace, and runs Node syntax checks over backend/config scripts.
The Vite production build remains the parser/build gate for JSX. A full ESLint
ruleset can be added later as a dedicated code-quality change without mixing a
large formatting rewrite into stabilization.

### Backend tests and coverage

Backend tests use Node's built-in test runner. This matches the existing test
files, which already import `node:test`, and removes Jest from the execution path.
The coverage gate uses Node's built-in V8 coverage with minimums:

- lines: 75%
- functions: 70%
- branches: 85%

The thresholds are baseline floors, not a claim that every feature is fully
covered. Raise them incrementally as low-coverage critical services receive tests.

### Frontend tests

Vitest + React Testing Library remain the existing frontend test stack.

### E2E test isolation

`npm run e2e` invokes an E2E `pretest` hook that drops only a database whose
name contains `test` or `e2e` (default: `trading-journal-e2e`) before Playwright
starts. The reset script refuses to drop a non-test database name.

Automated E2E identities use `.test` email addresses and test-only credentials.
Never use a production ROOT account in automated tests.

## CI

`.github/workflows/ci.yml` provisions MongoDB and runs:

1. clean locked dependency installation
2. source-hygiene lint
3. backend tests
4. backend coverage threshold gate
5. frontend tests
6. frontend production build
7. Playwright Chromium installation
8. E2E tests against an isolated E2E database
9. dependency audit (reported even when vulnerabilities are present so the
   complete test result remains visible)

Playwright traces/screenshots/videos are uploaded when a CI failure occurs.

## Environment separation

The CI workflow uses only test values:

- `MONGO_URI=mongodb://127.0.0.1:27017/trading-journal-test`
- test-only `SESSION_SECRET`
- `ci-root@tortoise-scroll.test`
- an isolated E2E database for Playwright

No production broker, market-data, email, or authentication credentials are
required for this phase.

## Dependency/security scanning

Run locally when registry access is available:

```bash
npm run audit:deps
```

CI also runs `npm audit --audit-level=high` for root/server/client/e2e. The CI
step is currently report-only (`continue-on-error`) so dependency advisories are
visible without obscuring application test failures. Promote it to a hard gate
once the initial audit backlog is reviewed and accepted/remediated.

## Distribution hygiene

`node_modules`, coverage output, build output, environment secrets, Playwright
reports/results, and log files are ignored by Git. Release/source ZIPs should be
created from tracked source (for example `git archive`) rather than zipping a
working directory containing installed dependencies.
