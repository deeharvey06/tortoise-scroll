# Phase 9 — Production operations

## 1. Implemented

Added configurable password-reset email delivery, Mongo-backed shared rate limiting, structured operational/security events, request/error IDs, dependency readiness, startup validation, graceful shutdown, and encrypted maintenance backup/recovery tooling. Existing authentication, authorization, CSRF, ROOT/ADMIN protections, ownership and financial behavior remain intact. No subsequent phase or AI functionality was implemented.

## 2. Architecture and design

Authentication uses an EmailProvider interface with disabled-development and SMTP adapters. Existing hashed, expiring, single-use reset tokens remain unchanged. Bounded asynchronous delivery avoids waiting for SMTP in the public reset response.

Production rate limits use atomic MongoDB buckets with separate namespaces and TTL cleanup. Development retains memory stores. Store failures fail closed. Operational services are separated from Express routes and bootstrap configuration is validated before initializing resources.

Logs allow only safe structured fields, including recursively sanitized child logger bindings. Readiness probes database, storage and email; liveness does not depend on them. Shutdown drains HTTP, jobs and email before closing resources. Startup waits for session-store initialization to avoid a shutdown race found in integration testing.

## 3. Files created

- `server/src/config/operations.js`
- `server/src/operations/{health,rateLimitStore,recovery,shutdown,startServer}.js`
- `server/src/services/email/{EmailProvider,SmtpEmailProvider,index,delivery}.js`
- `server/scripts/recovery.js`
- `server/tests/operations.test.js`
- `server/tests/integration/operations.test.js`
- `md/PHASE9_AUDIT.md`, `md/PRODUCTION_OPERATIONS.md`, this report

## 4. Files modified

- `README.md`; `server/package.json` and `server/package-lock.json`
- `server/server.js`; `server/src/app.js`
- `server/src/config/{db,index,logger}.js`
- `server/src/auth/rootProvisioning.js`
- `server/src/controllers/{accountSecurityController,backupController}.js`
- `server/src/middleware/{errorHandler,requestLogger,upload}.js`
- `server/src/queue/jobQueue.js`
- `server/src/routes/{authRoutes,backupRoutes}.js`
- `server/src/services/brokerSyncScheduler.js`
- `server/tests/{account-security,security-hardening}.test.js`

Dependency fixes include Nodemailer 10.0.10 and a js-yaml 4.3.2 override for the existing PM2 dependency, plus patched transitive HTTP dependencies.

## 5. Database/model changes

Added operational `rateLimitBuckets` with a `resetTime` TTL index. No user-data migration or financial model changes. Recovery intentionally clears restored sessions, reset tokens and limiter buckets and increments user session versions; passwords, roles and ownership are preserved.

## 6. API changes

Added `/api/ready` with bounded dependency checks and 200/503 status. `/api/health` remains liveness. Generated request/error IDs correlate responses and logs. Reset responses remain generic; delivery configuration does not claim successful delivery. Existing owner-scoped backup APIs retain their behavior with added success/failure events.

## 7. Frontend changes

None. Existing workflows, responsive layouts and themes are covered by regression tests.

## 8. Tests added/updated

Added provider/TLS/failure tests, production configuration validation, sensitive-data and child-binding redaction, HTTP health/readiness/error IDs, fail-closed limiting, bounded delivery, queue draining and shutdown deadlines. Updated reset/security fixtures without weakening production checks.

Real Mongo integration tests cover 80 concurrent increments across independent limiter stores, expiration and namespace isolation, encrypted dump/restore, BSON/index/file preservation, wrong-key/tamper/populated-target rejection, session invalidation, and a real server SIGTERM lifecycle. The restore drill exposed and fixed Mongo restore namespace filtering when the target URI included a database name.

## 9. Verification results

- Final `npm run ci:verify`: passed; 370 backend tests, 88 frontend tests, lint and production build.
- Final operations integration suite: 5 tests passed, including a real encrypted MongoDB/files restore drill and graceful process shutdown.
- Final full Playwright regression suite: 51 passed (1.7 minutes), including authorization, user isolation, existing product workflows and replay.
- Measured backend coverage: 81.71% lines, 90.43% branches, 82.74% functions; existing thresholds passed.
- Final server dependency audit: zero reported vulnerabilities.

Tests use isolated databases and temporary storage. No production database was restored or external email sent.

## 10. Security

Production rejects missing/insecure origins, secrets, Mongo TLS/authentication, email, proxy and storage settings, debug environments and reset-token exposure. SMTP requires verified TLS. Logs exclude arbitrary messages, exceptions, URLs, credentials, cookies and token content. Recovery uses AES-256-GCM, authenticates artifacts before database writes, requires maintenance acknowledgment and refuses populated targets. Mongo credentials are passed through private temporary configuration rather than command-line arguments.

## 11. Performance

Shared limiting adds a Mongo operation per applicable request. Readiness checks are bounded, briefly cached and deduplicated; email verification is throttled. Pending email is bounded at 32 deliveries per process. Recovery streams encrypted data/files but requires downtime and temporary disk capacity. No new throughput or horizontal-scaling benchmark is claimed.

## 12. Known limitations

SMTP connectivity is verified by startup, but actual inbox delivery, deployment proxy/storage settings, off-site retention and external alerting require operator verification. Local restore tests do not establish reliability of an untested production backup.

The existing job queue remains process-local and non-durable; unrestricted horizontal scaling is not supported. Multiple instances require shared storage and disabled per-instance broker scheduling. Pending reset mail can be lost on process failure. Maintenance backups require all writers stopped. Failed restores can leave a partially populated isolated target; abrupt host termination can leave private plaintext staging files, so encrypted scratch storage is recommended.

## 13. Remaining technical debt

Durable distributed jobs, coordinated broker scheduling, deployment-specific monitoring/alerting and a recurring off-site restore-drill policy remain separate work. Safe structured logging intentionally sacrifices raw exception detail. Existing unrelated schema warnings are unchanged.

## 14. Recommended next phase

Operator staging validation of real SMTP reset-to-login delivery, proxy trust, mounted storage, alerts and off-site restore procedures before production rollout. No additional product phase or deployment was started. See [the operations runbook](PRODUCTION_OPERATIONS.md) for required configuration and recovery commands.
