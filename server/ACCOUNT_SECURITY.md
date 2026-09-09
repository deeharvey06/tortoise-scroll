# Account and session security policy

## Password changes

A password change requires the current password. On success, the server increments the user's session version, revokes every other known session, rotates the current session identifier, and keeps only that new current session authenticated. Sessions created before the session registry existed are still invalidated by the version check.

## Password resets

Reset tokens contain 256 bits of cryptographic randomness, expire after `PASSWORD_RESET_TTL` milliseconds (30 minutes by default), are stored only as SHA-256 hashes, and are atomically marked used. A successful reset increments the user's session version and invalidates every current session, including legacy sessions without registry metadata.

Forgot-password responses do not reveal whether an email exists. Email delivery is not integrated. A raw token is returned only when `PASSWORD_RESET_DEV_EXPOSE_TOKEN=true` outside production; tokens are never logged. Production deployments must integrate a transactional email provider before claiming reset-email delivery.

## Active sessions

The session identifier remains server-side and is never returned to the client. The UI receives an unrelated session-record ID plus minimal device metadata. Individual revocation is owner-scoped. The current session must use normal sign-out instead of the remote-revocation endpoint.
