# Secure Admin setup

Krishak permits exactly one designated administrator: `admin@gmail.com`.

## Preconditions

1. Apply the MySQL migrations in `drizzle/`.
2. Set server-only `DATABASE_URL` and `ADMIN_SETUP_SECRET` in local `.env`.
3. Start Krishak on `SERVER_URL` (default `http://localhost:3000`).
4. Keep the 12+ character Admin password only in the local process environment or enter it at the hidden prompt.

## Provision

```bash
node scripts/setup-admin.mjs
```

The script calls only `POST /api/community/auth/admin-bootstrap` with the request field `setupSecret`; it never inserts a password hash itself. The server locks the email, checks the secret with constant-time comparison, enforces the password minimum and single-Admin rule, and returns a database-backed opaque session token. The script then verifies the database row without printing a password, setup secret, hash, or token.

## Verify

With the app running:

```bash
ADMIN_PASSWORD='local-password-value' node scripts/verify-admin.mjs
```

The verifier checks the exact database row, login, session, `/admin` application route, metrics, Farmer list, complaint queue/detail, solution, resolve persistence, deletion, logout/revocation, public role-spoof resistance, Farmer denial, and complaint IDOR. It uses current routes under `/api/community`; the removed `/admin/create` route is not supported.

If `DATABASE_URL` or a usable local Admin password is absent, provisioning/login cannot be claimed as verified.
