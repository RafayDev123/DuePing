# DuePing setup guide

## 1. What you need

| Service | Required? | Where to get it | Cost | Variable(s) |
| --- | --- | --- | --- | --- |
| PostgreSQL 14+ | **Required** | Docker (`docker compose up -d db`), or Supabase / Neon / Railway / RDS (any Postgres) | free locally; hosted tiers vary | `DATABASE_URL` |
| Node.js 22 | **Required** | nodejs.org | free | – |
| App secrets | **Required** | generate yourself | free | `APP_ENCRYPTION_KEY` (`openssl rand -base64 32`), `CRON_SECRET` (`openssl rand -hex 32`) |
| Resend (email) | Optional but needed to send reminders / invoices | resend.com → API Keys, Domains | free tier then usage-based | entered **in the app** (Settings → Email delivery); stored encrypted per workspace |
| Platform mailer | Optional (enables mandatory email verification) | same Resend account | as above | `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` |
| Resend webhook | Optional (delivered / bounced states) | Resend → Webhooks → endpoint `https://YOUR-APP/api/v1/webhooks/resend` | – | `RESEND_WEBHOOK_SECRET` |
| WhatsApp Business Platform | Optional (click-to-chat needs nothing) | developers.facebook.com → WhatsApp → API setup | Meta per-conversation pricing | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_NAME` |

Secrets belong in `.env` locally and in your host's environment settings in production. **Never commit `.env`.** Only `NEXT_PUBLIC_*` values reach the browser, and only the public URL uses that prefix.

## 2. Local development

```bash
cp .env.example .env     # fill DATABASE_URL, APP_ENCRYPTION_KEY, CRON_SECRET; set AUTH_DEV_LINKS=true
docker compose up -d db
npm ci
npx drizzle-kit push
npm run dev
npm run worker           # separate terminal
```

With no platform mailer configured, accounts are auto-verified and password-reset links are shown on screen only when `AUTH_DEV_LINKS=true`.

## 3. Database (Supabase or any Postgres)

DuePing uses a plain Postgres connection string. For Supabase: Project settings → Database → Connection string (use the *session pooler* or direct URL) → `DATABASE_URL`. Then run `npx drizzle-kit push` (or apply the SQL in `drizzle/` with `psql`). Row Level Security is not used — see docs/SECURITY.md before exposing the database to any other client.

## 4. Email

1. Create a Resend account, verify your sending domain, create an API key.
2. In DuePing: Settings → Email delivery → paste the key, sender (on the verified domain) → Save → **Send test email to me**. Success marks the sender verified (it means the provider *accepted* the message).
3. Reminders → complete the checklist (review templates, confirm preferences) → Enable.
4. Optional: add the webhook so "delivered" and "bounced" states appear. Until then, messages show as **accepted**.

## 5. WhatsApp

* **Click-to-chat (works now):** store the client's phone in international format; Invoice → WhatsApp → review → Open in WhatsApp → press send.
* **Business API (optional, untested here):** complete Meta business verification, create and get approval for a template with four body variables (name, invoice number, balance, due date), set the four `WHATSAPP_*` variables, record the client's consent. Without all of these DuePing falls back to manual tasks.

## 6. Background worker

* Dedicated (recommended): `npm run worker` as a long-running service next to the web app. Needs `DATABASE_URL` (+ `APP_URL`, `APP_ENCRYPTION_KEY`).
* Embedded: `EMBEDDED_WORKER=true` runs the same cycle in the web process (single instance only).
* External scheduler: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP/api/internal/run` every minute.
* All three are safe together — rows are claimed with `SKIP LOCKED` and sends are idempotent.

## 7. Deployment

See `docs/DEPLOYMENT.md`. Short version: deploy the Next.js app (Vercel, Fly, Railway, Docker) with the environment variables above, run `drizzle-kit push` against the production database, deploy the worker as a second process from the same repo, then verify with `BASE=https://YOUR-APP bash tests/smoke.sh` and the admin page (worker should show **Healthy**).

## 8. OCR (scanned PDFs)

Not included. Scanned PDFs are detected and the user is asked to enter details manually. To add OCR, implement a provider call in `extractPdf` (`src/services/imports.ts`) and set `OCR_API_KEY`.

## 9. Production verification checklist

- [ ] `/api/health` returns `{"ok":true}`
- [ ] Sign up → create client → invoice → partial payment → PDF
- [ ] Settings → Email → test email accepted
- [ ] Copy private link → opens in a private window, shows noindex, can be revoked
- [ ] Admin page shows worker Healthy
- [ ] No `.env` or secrets in the repository
