# Production operations runbook

This runbook covers Phase 9. Deployment infrastructure, external SMTP acceptance/deliverability, off-site storage, DNS/TLS issuance, and retention policies must be configured and verified by the operator. Passing local tests is not evidence of an existing production backup or working external inbox delivery.

## Required production configuration

Use the supported Node version from `.nvmrc`, a TLS reverse proxy, authenticated MongoDB with verified TLS, and persistent uploads storage. Inject secrets through the deployment's secret manager. Do not commit or print a populated `.env`. The application loads configuration before creating storage directories/clients.

| Setting | Required behavior |
| --- | --- |
| `NODE_ENV` | `production`; unknown values fail startup |
| `SESSION_SECRET` | At least 32 characters, randomly generated, non-placeholder; share across app instances |
| `MONGO_URI` | Explicit database, authentication, and TLS; SRV enables TLS by default; invalid-certificate/TLS-disable overrides are rejected |
| `CLIENT_ORIGIN` | Exact HTTPS frontend origin present in `ALLOWED_ORIGINS` |
| `ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins, without paths or wildcards |
| `PASSWORD_RESET_URL` | Exact trusted HTTPS reset page URL, e.g. `https://journal.your-domain/reset-password`; no query, fragment or embedded credentials |
| `EMAIL_PROVIDER` | `smtp` in production; `disabled` is the safe development default |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Real SMTP server credentials and a verified sender address |
| `SMTP_PORT` | 587 by default for required STARTTLS; use 465 with `SMTP_SECURE=true` for implicit TLS |
| `SMTP_SECURE` | `false` for required STARTTLS, `true` for implicit TLS; certificate validation cannot be disabled |
| `RATE_LIMIT_STORE` | `mongo` in production; `memory` default in development/tests |
| `TRUST_PROXY` | Explicit proxy IP/CIDR list or Express named subnet; `none` disables proxy trust. Broad `true`, numeric hop counts and `/0` are rejected |
| `UPLOADS_DIR` | Absolute path to an existing/persistently mounted uploads volume; includes screenshots, media and private knowledge originals |
| `UPLOADS_STORAGE_MODE` | `local` for a persistent single-instance volume, `shared` when replicas access the same storage |
| `DEPLOYMENT_MODE` | `single` default; `multi` additionally requires shared uploads and `BROKER_SYNC_SCHEDULER_ENABLED=false` |
| `SHUTDOWN_TIMEOUT_MS` | Default 30000; orchestrator termination grace must exceed this plus load-balancer removal time |
| `CSRF_PROTECTION_ENABLED` | Must not disable protection in production |
| `PASSWORD_RESET_DEV_EXPOSE_TOKEN` | Must not be `true` in production |
| `LOG_LEVEL` | Structured Pino level; do not enable `DEBUG`, `NODE_DEBUG` or `NODE_DEBUG_NATIVE` in production |

`NODE_TLS_REJECT_UNAUTHORIZED=0` is rejected. Provision ROOT through the existing mechanism only; remove `ROOT_USER_INITIAL_PASSWORD` after initial provisioning. Startup logs a reminder if it remains set. Existing ROOT/ADMIN ownership and authorization are unchanged.

Changing `UPLOADS_DIR` selects a location; it does not migrate old files. Copy existing uploads during maintenance and verify them before changing the mount. Any `MARKET_DATA_LOCAL_ROOT` used by multiple replicas must also reference consistent shared historical data. Phase 9 does not create cloud storage or a second market-data provider.

## Reverse proxy and network boundary

Expose only the TLS proxy, not the API port. Configure `TRUST_PROXY` to match the actual trusted proxy network; never trust headers from arbitrary internet clients. The proxy must replace forwarded headers rather than accept untrusted originals. Preserve existing secure `__Host-` session cookies, exact-origin CORS, and CSRF headers.

Access logs at the proxy/CDN must omit raw URLs/query strings, request bodies, cookies, authorization, and SMTP details. A minimal Nginx log format can use method, status and the upstream generated correlation ID:

```nginx
log_format tortoise_ops escape=json
  '{"method":"$request_method","status":$status,"request_id":"$upstream_http_x_request_id"}';
```

Set `Referrer-Policy: no-referrer` on the frontend as well as API responses. Reset tokens appear in the reset page query string and must not reach third-party analytics, referer headers or proxy access logs. The application's logger never records URLs or request bodies.

## Startup and readiness

Start via `node server/server.js` or the existing npm start command with the production environment loaded by the supervisor. Startup validates settings, connects to MongoDB, initializes shared rate-limit TTL indexing, probes storage, verifies the SMTP connection, provisions/checks ROOT, and waits for Mongo session-store initialization before listening. SMTP verification tests connectivity/authentication, not inbox deliverability.

- `GET /api/health`: process liveness, 200, independent of sessions/database/rate limits.
- `GET /api/ready`: 200 when database ping, storage write/read/delete and configured email health succeed; otherwise 503. Responses contain only up/down states. Checks are bounded and briefly cached; SMTP health retries are throttled.
- During draining, readiness becomes 503 immediately and new application requests receive 503. Liveness remains available while the HTTP listener is open.

Probe endpoints retain request IDs and security headers, bypass session and rate-limit dependency checks, and expose no credentials, paths or connection strings. Restrict probe traffic at the infrastructure boundary if needed.

## Email delivery

Authentication depends on `EmailProvider`, not a vendor SDK. SMTP configuration can select a compatible provider without changing authentication code. The SMTP adapter requires TLS, disables protocol logging/file/URL access and bounds network timeouts. See the [Nodemailer SMTP transport documentation](https://nodemailer.com/smtp) for the transport options.

The existing 32-byte random token, SHA-256-only database storage, expiry, atomic single use, and all-session revocation are preserved. Both unknown accounts and delivery failures receive the same generic public response. `deliveryConfigured` describes configuration, not successful delivery.

Up to 32 deliveries per process may be pending. Dispatch does not wait on SMTP before responding, avoiding a new network-latency enumeration signal. Overflow/failure is logged without the email address or token. Shutdown drains pending mail. The queue is deliberately in memory so raw reset tokens are not persisted; a process crash can lose pending delivery, and the user must request another link. There is no claim of exactly-once delivery or inbox acceptance. Verify sender/domain records, spam handling and an actual reset-to-login flow in deployment before rollout.

## Shared rate limiting and scale limits

Production login/register, reset and general API limits use independent namespaces in MongoDB `rateLimitBuckets`. Atomic updates use Mongo's clock, and expired buckets reset on access even before TTL deletion. Keys hash normalized client IP keys; raw client IPs are not stored in buckets. Store errors fail closed with 503; there is no production memory fallback. Existing request budgets remain unchanged.

Mongo availability is now also a request-protection dependency. Monitor `RATE_LIMIT_STORE_FAILED`, 429/503 rates and Mongo latency. Shared limits do not make all application state distributed: the existing job queue/status is process-local and non-durable. Use appropriate worker affinity for job submission/status or keep one application worker until a separately approved durable queue migration. Multi-instance broker scheduling is disabled to avoid duplicate scheduling; a single designated scheduler remains an operator decision. Shared files and historical data mounts are required. Do not advertise unrestricted horizontal scaling.

## Structured events and incident handling

Logs use an allowlist of event codes, generated request/error IDs, component, outcome, counts, status and duration. Arbitrary objects, Error text/stacks, log strings, URLs, headers, cookies and mail content are excluded, including child logger bindings. Request IDs are generated server-side rather than trusting client header contents. `X-Request-Id` identifies a response; failed responses additionally include `X-Error-Id` and `error.errorId`.

Monitor at least:

- `STARTUP_FAILED`, `HTTP_LISTEN_FAILED`, database disconnect/error events
- `HTTP_REQUEST_FAILED`, `ACCESS_REJECTED`, `RATE_LIMIT_REJECTED`, `RATE_LIMIT_STORE_FAILED`
- `LOGIN_REJECTED`, `LOGIN_SUCCEEDED`, password/session security events (existing database audits also remain)
- `PASSWORD_RESET_DELIVERY_FAILED`, `PASSWORD_RESET_DELIVERY_OVERLOADED`
- `BACKUP_EXPORT_FAILED`, `BACKUP_RESTORE_FAILED`, `RECOVERY_BACKUP_FAILED`, `RECOVERY_RESTORE_FAILED`
- `SHUTDOWN_TIMEOUT`, `SHUTDOWN_FAILED`, `UNHANDLED_REJECTION`, `UNCAUGHT_EXCEPTION`

Alert on missing expected backup-success events as well as explicit failures. Choose alert windows, retention, access controls and RPO/RTO from the deployment's requirements. This phase emits events; it does not provision an external monitoring account or claim alerts are already configured. Log secrecy intentionally limits exception detail; use safe event/configuration codes and isolated reproduction instead of enabling raw production request logging.

## Graceful shutdown

SIGTERM/SIGINT mark the process draining, stop future broker scheduling, close/drain HTTP connections and pending jobs, drain mail, and close mail/session/Mongo resources. Repeated signals reuse the same shutdown operation. The global deadline forces exit with a failure event if work cannot finish. Unhandled failures trigger a failing shutdown rather than continuing in an unknown state. Existing in-memory jobs are not crash-durable; the queue now drains pending work and refuses new jobs after draining starts.

## Database and private-file backup

The existing user JSON export remains a portable owner-scoped export, not disaster recovery. It omits auth records and file bytes and may report partial restore failure. Its successes/failures now generate operational events.

The operator recovery tool requires `mongodump` and `mongorestore` and a separate `BACKUP_ENCRYPTION_KEY`: canonical base64 encoding of 32 random bytes. Store that key securely outside the backup and preserve historical keys for retained backups. Do not confuse it with session or broker encryption keys. Back up other application encryption secrets separately in the secret manager; they are not included in file backups.

### Create a recovery artifact

1. Stop ALL application instances, queues, schedulers, imports and other database/file writers. Wait for shutdown completion. This is a maintenance backup, not an online snapshot protocol.
2. Set operator environment variables: `MONGO_URI` (explicit source database), `UPLOADS_DIR`, optional `MARKET_DATA_LOCAL_ROOT`, `BACKUP_ENCRYPTION_KEY`, and `RECOVERY_MAINTENANCE_CONFIRMED=true`.
3. Run `npm run recovery --prefix server -- backup /secure-backups/NEW_ARTIFACT_DIRECTORY`.
4. Require exit status 0 and `RECOVERY_BACKUP_COMPLETED`. Copy the encrypted artifact directory to the chosen restricted off-site/immutable storage. A partial artifact without a valid authenticated manifest is not a completed backup.
5. Restart service and check readiness. Schedule the next restore drill according to the chosen recovery policy.

The tool refuses existing artifact directories and source/output overlap. It exports the full application database, records collection counts and SHA-256 integrity, encrypts the database and every file with independent AES-256-GCM nonces, and writes an encrypted manifest last. No URI is passed on argv; MongoDB tools receive a temporary owner-only configuration file. Tool output is suppressed. Temporary plaintext has an owner-only parent directory and is cleaned on ordinary completion/failure. Abrupt host termination can leave a staging directory; use encrypted scratch storage and a controlled cleanup policy.

### Recover safely

1. Keep application traffic and writers stopped. Select a NEW empty database and empty uploads/historical-data target directories. The tool refuses populated targets and never uses `--drop`.
2. Set the target `MONGO_URI`, target `UPLOADS_DIR`/optional `MARKET_DATA_LOCAL_ROOT`, the matching backup key, and `RECOVERY_MAINTENANCE_CONFIRMED=true`.
3. Run `npm run recovery --prefix server -- restore /secure-backups/ARTIFACT_DIRECTORY`.
4. Require exit status 0 and `RECOVERY_RESTORE_COMPLETED`. Authentication tags and file/database checksums are verified before database restore; restored collection counts must match before success. BSON and indexes are restored with source-to-target namespace remapping.
5. Old sessions, session records, outstanding reset tokens and limiter buckets are cleared, and user session versions increment. Users must sign in again; passwords/roles/ownership and financial data are preserved.
6. Verify database counts, owner-isolated account/trade records, financial examples, source originals/screenshots, broker-secret decryption using the retained key, readiness, and a login/reset flow. Only then switch application configuration/traffic to the recovered targets.

A failed restore can leave the previously empty target partially populated; do not start the application on it or call that backup verified. Investigate, choose another empty target, and repeat. The tool does not roll back or delete an operator's populated database.

## Verification commands and demonstrated scope

```sh
npm run ci:verify
npm run test:operations:integration --prefix server
npm test --prefix e2e
```

The integration suite uses unique temporary local MongoDB databases, performs a real encrypted dump/restore with BSON/index/file checks, rejects tampered artifacts/wrong keys/populated targets, verifies session invalidation, tests 80 concurrent increments across two independent limiter instances, and starts/stops a real server process. It never selects the working application database. These tests establish the tested maintenance recovery procedure; they do not verify an operator's current backups, off-site retention or external email service.
