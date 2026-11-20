# Security

* **Passwords**: scrypt (N=16384) with per-user salt; constant-time compare; unknown-account logins do equal work. Sessions: 256-bit random token in an HttpOnly, SameSite=Lax (Secure behind HTTPS) cookie; only the SHA-256 hash is stored; password reset revokes all sessions.
* **Authorization**: every API call resolves the workspace from the session membership (re-verified on every request) and checks a role→permission matrix. Viewers are read-only; payments need owner/admin/accountant.
* **Tenant isolation**: *application-layer*. Every service query includes `workspace_id`; foreign ids from other workspaces behave as "not found". Covered by `tests/integration`. **PostgreSQL RLS is not enabled** because the app uses a single DB role instead of Supabase Auth. If you expose the database to other clients (e.g. Supabase PostgREST), enable RLS first.
* **CSRF**: SameSite=Lax + Origin/Host check on mutating requests; JSON-only bodies.
* **Client portal**: 256-bit tokens, only SHA-256 stored, expiry, revocation (also on void), per-IP and per-token rate limits, `noindex` metadata + `X-Robots-Tag` on the PDF, internal notes never selected, IPs stored as salted hashes, payment reports only create verification requests.
* **Uploads**: size limit, magic-byte type detection (client MIME ignored), PDFs with `/JavaScript`, `/JS`, `/Launch` or `/EmbeddedFile` rejected, stored as opaque bytes, served as `attachment` + `nosniff` + sandbox CSP, never executed or publicly addressable.
* **Secrets**: integration API keys encrypted with AES-256-GCM (`APP_ENCRYPTION_KEY`), never returned to the browser; no secrets in client bundles; `.env` is git-ignored.
* **Injection / output**: parameterised SQL everywhere (Drizzle tagged templates; the few `sql.raw` uses take validated dates, enum-mapped column names or UUID-sanitised ids); email HTML escapes all dynamic text; CSV/XLSX exports neutralise formula injection.
* **Webhooks/cron**: Resend webhook verifies Svix signature + timestamp; `/api/internal/run` requires a constant-time-compared bearer secret.
* **Financial integrity**: append-only ledger, locked invoice rows during payment, overpayment rejection, reversal uniqueness, audit log for financial and security events, no card or bank credentials stored.
* **Not covered**: formal pen-test, Sentry/alerting, WAF, malware scanning of uploads (type + active-content checks only), MFA.
