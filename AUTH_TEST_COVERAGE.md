# Phase 7–8 authentication test coverage

No product behavior was added in these phases. The work extends unit, integration, component, and browser coverage around the authentication and authorization system delivered in Phases 1–6.

Verified suite totals for this phase:

- Backend unit/integration: 109 passing.
- Frontend unit/component: 53 passing.
- Playwright E2E: 42 scenarios discovered across four specifications; live execution requires MongoDB.

| Requirement | Unit/component coverage | Integration/API coverage | Browser/E2E coverage |
| --- | --- | --- | --- |
| Authentication | Auth store bootstrap and login/register UI | Registration, duplicate handling, generic login failures, login audit events | Register, valid/invalid login, persistence, logout |
| Authorization | `ProtectedRoute`, `AdminRoute`, and `RootRoute` matrix | Role middleware and direct protected API denial | Unauthenticated, USER, ADMIN, and ROOT paths |
| Sessions | Session UI and service behavior | Session regeneration, listing, individual revoke, logout-others, logout, version invalidation | Persistence, logout, password-change invalidation of a second browser session |
| Roles | All role gates and account-menu identity | User role enum and direct middleware checks | USER denial, ADMIN read-only access, ROOT access |
| ROOT protection | ROOT controls excluded from its own UI row | Unique ROOT index; cannot create, promote, demote, suspend, delete, or target ROOT | Malicious public escalation and direct ROOT mutation attempts |
| ADMIN protection | Audit/mutation controls hidden | ADMIN cannot mutate roles/status, access audit log, or view ROOT | Read-only Administration page plus direct API attacks |
| User isolation | N/A | Required ownership on all user-data models and cross-user trade/journal/strategy/AI/import/backup denial | Two real USER sessions prove USER B cannot read, edit, or delete USER A's trade through direct APIs |
| Password security | Minimum-length registration feedback | Argon2id hashing, safe field selection, password reuse rejection, lockout, generic failures | Password change and new-password login flows |
| Reset flow | Forgot/reset UI success and error states | Non-enumeration, SHA-256 token-at-rest, expiry, single use, session revocation, audit event | Full reset and attempted token reuse |
| Suspension | Suspended route state | Suspended/disabled login rejection and active-session version invalidation | ROOT suspension followed by active-session rejection and blocked login |
| Rate limiting | N/A | Production-mode limit exhaustion and 429 headers | Covered at API integration level to avoid intentionally throttling the shared E2E suite |
| CSRF/CORS | Axios unsafe-method marker | Missing marker, malicious origin, and exact allowlist checks | Direct requests without CSRF and from an untrusted origin |
| Frontend routes/UI | Loading, network, expired, forbidden, suspended, unauthenticated, and all role states | N/A | Protected navigation, access denied, Administration, Account Security |
| Themes | Auth and Administration views render under both themes | N/A | Auth and ROOT Administration in explicit light/dark modes |

## Remaining environment gaps

- The complete Playwright suite requires a real MongoDB instance. The suite compiles and all scenarios are discovered in this workspace, but live execution cannot start here because no MongoDB server or executable is available.
- Password-reset email delivery is intentionally not implemented, so provider delivery/bounce tests do not exist. Token creation and consumption are covered.
- Rate limiting uses the configured application-process store. A horizontally scaled deployment should use a shared limiter store and add multi-instance tests.
- Test assertions cover the requested authentication behavior, but the project does not currently enforce a numeric line/branch coverage threshold in CI.
