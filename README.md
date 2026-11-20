# DuePing

Invoice management, payment tracking and respectful reminder automation for freelancers, agencies and small businesses.

> **Track every invoice. Follow up without the stress.**

DuePing *records* payments you confirm. It is not a bank, payment processor or accounting service.

## What is implemented

| Module | Status |
| --- | --- |
| Auth (email + password, scrypt, DB sessions, optional email verification & reset), workspaces, roles | ✅ working |
| Clients (CRUD, search/filter, notes, balances per currency, CSV export, archive) | ✅ working |
| Invoices (editor with live preview, numbering, drafts, send/duplicate/void/archive, PDF, print, private links, attachments, recurring drafts, bulk actions) | ✅ working |
| Payment ledger (partial payments, overpayment guard, reversal, correction, verification requests) | ✅ working |
| Reminders (rules, 3-language templates, quiet hours/timezones, checklist gate, calendar, pause/retry, idempotent worker) | ✅ working — email send needs *your* Resend key |
| WhatsApp (official click-to-chat; optional Business API adapter) | ✅ click-to-chat working · ⚠️ API adapter implemented, **untested** (needs credentials) |
| Dashboard, reports (8 types, CSV/XLSX/PDF), notifications, audit log | ✅ working |
| CSV import (mapping, validation, duplicates, error report) and PDF import (extraction + mandatory review) | ✅ working · OCR for scanned PDFs: not included (clear fallback shown) |
| Client portal (hashed tokens, expiry, revocation, rate limit, payment reports, noindex) | ✅ working |
| Public site (home, features ×4, pricing, about, contact, help, 6 guides, FAQ, legal), SEO/AEO/GEO | ✅ working |
| Admin panel (counts, queue, failures, worker health, storage, audit — no customer amounts) | ✅ working |

### Deliberate deviations from the original brief (read these)

The brief named Supabase, Redis/BullMQ, shadcn/ui, TanStack Table, Recharts, React Hook Form and Playwright. This build runs on the platform's PostgreSQL + Drizzle ORM and keeps dependencies small:

* **Database/Auth** – plain PostgreSQL via Drizzle; custom session auth instead of Supabase Auth. **Row Level Security is not used**; tenant isolation is enforced in the service layer (every query is scoped by a server-verified workspace id) and covered by integration tests. See `docs/SECURITY.md`.
* **Queue** – a PostgreSQL-backed queue (`FOR UPDATE SKIP LOCKED` + idempotency keys) replaces Redis/BullMQ; a dedicated worker (`npm run worker`) or the optional embedded worker processes it.
* **Storage** – files are stored in a private `bytea` table and served only through authenticated, workspace-scoped routes.
* **UI** – hand-built accessible components (native `<dialog>`, URL-driven filters, SVG chart) instead of shadcn/TanStack/Recharts/RHF.
* **Tests** – Vitest unit + DB integration tests and an HTTP smoke script. Playwright E2E and Sentry are **not** included.
* `payment_allocations`, `api_keys`, `usage_events`, `report_jobs`, `export_jobs`, `idempotency_keys` tables from the brief were not needed: a payment belongs to exactly one invoice; exports are synchronous; idempotency lives on `reminder_schedules.idempotency_key` and the provider `Idempotency-Key` header.
* Billing is not connected (all workspaces are on the free plan; the pricing page says so).

## Quick start

```bash
cp .env.example .env            # set DATABASE_URL, APP_ENCRYPTION_KEY, CRON_SECRET
docker compose up -d db         # or use any PostgreSQL 14+
npm ci
npx drizzle-kit push            # create tables
npm run dev                     # http://localhost:3000
npm run worker                  # in another terminal (or set EMBEDDED_WORKER=true)
```

Sign up (the first account becomes platform admin), then use **Load demo data** on the empty overview, or `npm run seed -- you@example.com`.

## Commands

| | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npx tsc --noEmit` | static checks |
| `npm test` | Vitest (unit + integration — integration needs `DATABASE_URL`) |
| `BASE=http://localhost:3000 bash tests/smoke.sh` | HTTP smoke test against a running app |
| `npm run worker` | reminder / recurring / notification worker |
| `npx drizzle-kit generate` | SQL migration files into `drizzle/` |

More: [GUIDE.md](GUIDE.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/API.md](docs/API.md) · [docs/SECURITY.md](docs/SECURITY.md) · [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/TESTING.md](docs/TESTING.md) · [docs/SEO.md](docs/SEO.md) · [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) · [CHANGELOG.md](CHANGELOG.md)
