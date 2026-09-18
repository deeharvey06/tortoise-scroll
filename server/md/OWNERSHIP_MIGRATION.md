# Ownership migration

This migration assigns every legacy record without `userId` to the one active account configured by `ROOT_USER_EMAIL`. It never deletes records and never overwrites an existing owner.

## Before running

1. Back up MongoDB and the `server/uploads` directory.
2. Set `MONGO_URI` and `ROOT_USER_EMAIL`.
3. Start once normally so the configured ROOT account exists.
4. Stop application writes while the migration runs.

## Run

```sh
npm run migrate:ownership
```

The command aborts unless exactly one active ROOT matches `ROOT_USER_EMAIL`. Its JSON report includes collection counts before and after, modified and ROOT-owned counts, legacy relationship repairs, relationship checks, index synchronization, and `dataDeleted: false`.

A single legacy `RiskSettings` record whose optional `accountId` points to a missing account is normalized into global risk settings (`accountId: null`). The record and every configured risk limit are preserved. The migration refuses this repair if multiple dangling records or an existing global settings record would make it ambiguous.

Success requires identical before/after counts, zero unowned records, and zero broken relationships. The migration is idempotent: a successful second run reports zero modified records.
