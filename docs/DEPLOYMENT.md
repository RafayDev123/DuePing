# Deployment

1. **Database** – provision PostgreSQL 14+. Set `DATABASE_URL`. Run `npx drizzle-kit push` (or apply `drizzle/*.sql`).
2. **Web** – any Node 22 host (Vercel, Fly.io, Railway, Docker). Build `npm ci && npm run build`, start `npm start`. Set `APP_URL`, `NEXT_PUBLIC_APP_URL`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` (+ optional variables from `.env.example`). Put the app behind HTTPS (cookies become `Secure` when `x-forwarded-proto=https`).
3. **Worker** – run `npm run worker` as a second always-on process from the same code and env (Fly machine, Railway service, `docker compose --profile app`, systemd). On serverless hosts without long-running processes, call `POST /api/internal/run` every minute from a scheduler instead (Vercel Cron, GitHub Actions, cron-job.org) with the bearer secret.
4. **Webhook** – Resend → Webhooks → `https://YOUR-APP/api/v1/webhooks/resend`; copy the signing secret to `RESEND_WEBHOOK_SECRET`.
5. **Verify** – `BASE=https://YOUR-APP bash tests/smoke.sh`; sign in as the first (admin) account → `/admin` shows worker *Healthy*.
6. **Backups** – nightly `pg_dump`; test restores. **Monitoring** – watch `/api/health`, the admin page (failed jobs, system errors) and your provider dashboards.
7. **Rollback** – deployments are stateless; roll back the app image. Schema changes are additive (`drizzle-kit push` does not drop columns without `--force` prompts).
