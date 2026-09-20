# Phase 9 production-operations audit

Express/Mongoose already supplies Mongo-backed sessions, Argon2 passwords, hashed/expiring/single-use reset tokens, session revocation, CSRF and owner isolation. Reset delivery is missing. The three express-rate-limit stores are process-local. Pino exists but raw URLs, Morgan and console exception/connection logs can disclose sensitive values. Health does not test dependencies; server shutdown does not drain work. Broker scheduling may reschedule after stop. The process-local job queue is not durable or distributed.

Existing owner-scoped JSON export omits user/auth records and original uploads and is not disaster recovery. It reports partial per-collection restore failure. Preserve this API, add operational success/failure events, and separately test whole-database plus private-file recovery with MongoDB tools in an isolated target.

Extend existing abstractions: SMTP/disabled EmailProvider; Mongo atomic shared rate-limit store; allowlisted structured logs and correlation/error IDs; liveness independent of dependencies; bounded DB/storage readiness; startup configuration checks; deadline-based HTTP/job/scheduler draining and resource closure. Production requires explicit trusted origins, reset URL, SMTP, Mongo, proxy and storage configuration. Local development keeps safe defaults. No financial changes, user-data migration, or unrelated UI.

Tests will cover provider errors, token/log secrecy, production configuration, health/readiness, shutdown, concurrent shared buckets on real MongoDB, backup integrity and a real database/file restore drill. Existing auth/reset/isolation and E2E regressions must pass. External email delivery and operator off-site retention cannot be claimed tested without deployment credentials.

Implementation and verification outcomes are recorded in [the Phase 9 completion report](PHASE9_REPORT.md). Deployment configuration and recovery procedures are in [the production operations runbook](PRODUCTION_OPERATIONS.md).
