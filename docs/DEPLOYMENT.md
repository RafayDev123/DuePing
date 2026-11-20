# Deployment

## Vercel

1. Import the GitHub repository into Vercel and keep the detected Next.js framework and default build settings (`npm run build`).
2. Provision a managed PostgreSQL 14+ database reachable from Vercel. Set `DATABASE_URL` in the Vercel project settings for Production (and Preview if desired). From a trusted local environment, run `npx drizzle-kit push` with `DATABASE_URL` pointing to that production database to create/update its schema. Do not commit `.env` or paste its contents into source files.
3. Set `APP_URL` and `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin, `APP_ENCRYPTION_KEY` to a new random 32+ character secret, and `CRON_SECRET` to a separate random secret. Add any optional integration variables from `.env.example` only when configuring those integrations. Redeploy after setting or changing environment variables.
4. Vercel does not run the standalone `npm run worker` process. To process reminders and recurring invoices, configure a scheduler to request `GET /api/internal/run` (or `POST`) with `Authorization: Bearer <CRON_SECRET>`. Vercel Cron can call the GET route when configured in `vercel.json`; an external scheduler can also call it. Without a scheduler, queued work will not be processed.
5. After deployment, check `/api/health`, create the first account, and verify database-backed pages. Configure backups for the database provider.

## Other hosts

1. **Database** – provision PostgreSQL 14+. Set `DATABASE_URL`. Run `npx drizzle-kit push` (or apply `drizzle/*.sql`).
2. **Web** – any Node 22 host (Fly.io, Railway, Docker). Build `npm ci && npm run build`, start `npm start`. Set `APP_URL`, `NEXT_PUBLIC_APP_URL`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` (+ optional variables from `.env.example`). Put the app behind HTTPS (cookies become `Secure` when `x-forwarded-proto=https`).
3. **Worker** – run `npm run worker` as a second always-on process from the same code and env (Fly machine, Railway service, `docker compose --profile app`, systemd). On serverless hosts without long-running processes, call `/api/internal/run` on a schedule with the bearer secret.
4. **Webhook** – Resend → Webhooks → `https://YOUR-APP/api/v1/webhooks/resend`; copy the signing secret to `RESEND_WEBHOOK_SECRET`.
5. **Verify** – `BASE=https://YOUR-APP bash tests/smoke.sh`; sign in as the first (admin) account → `/admin` shows worker *Healthy*.
6. **Backups** – nightly `pg_dump`; test restores. **Monitoring** – watch `/api/health`, the admin page (failed jobs, system errors) and your provider dashboards.
7. **Rollback** – deployments are stateless; roll back the app image. Schema changes are additive (`drizzle-kit push` does not drop columns without `--force` prompts).
