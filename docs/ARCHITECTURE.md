# Architecture

```
Browser ──► Next.js 16 (App Router)
             ├─ Server components: read through services/* (SQL via Drizzle `db.execute`)
             ├─ Route handlers /api/v1/*: `route()` wrapper → auth → role check → rate limit → Zod → service
             ├─ Public: marketing pages, /portal/[token] (+pdf), /api/portal/[token]/report, webhooks
             └─ instrumentation.ts: optional embedded worker
PostgreSQL ◄─ services/*  (all tenant data carries workspace_id; every query is scoped)
Worker (npm run worker | embedded | POST /api/internal/run) ─► services/worker.ts
Providers: Resend (email, via lib/email.ts adapter), WhatsApp (click-to-chat; Cloud API adapter in lib/whatsapp.ts)
```

## Layers
* `src/lib` – pure helpers (money, invoicing math, dates/timezones, status derivation, crypto, csv, pdf, templates, validation schemas, API wrapper, auth/session).
* `src/services` – business logic (invoices, payments, reminders, worker, portal, imports, reports, dashboard, team, account, integrations, demo).
* `src/app` – UI routes and REST API. `src/components` – UI.
* `worker/`, `scripts/` – process entry points. `tests/` – automated tests.

## Key decisions
* **Money**: BigInt minor units, per-currency decimals (ISO 4217 overrides for PKR etc.), `NUMERIC(20,4)` storage; no floats in totals, balances or sums. Currencies are never added together.
* **Status is derived** (`lib/status.ts`, mirrored in SQL) from stored lifecycle (`draft|sent|cancelled|void`), the payment ledger and the due date in the workspace timezone — contradictory states cannot be stored.
* **Ledger** is append-only: payments are positive rows, reversals negative rows pointing at the original (`reverses_payment_id` is unique), corrections = reversal + new linked payment, all inside one transaction with the invoice row locked (`FOR UPDATE`).
* **Queue**: `reminder_schedules` rows are claimed with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`; stuck `processing` rows are reclaimed after 10 min; the provider receives `Idempotency-Key = invoice:rule:dueDate`; the key changes with the due date so old schedules are cancelled. At send time the worker re-validates: automatic reminders enabled, invoice sent & open, balance > 0, client not paused/archived, key still current, not in quiet hours, contact available, provider verified.
* **Why not Redis/BullMQ**: no Redis in the target environment; Postgres gives the same at-least-once + idempotent semantics for this volume. Swap-in point: `runWorkerCycle()`.
* **Files** are validated by magic bytes, stored as `bytea`, served as attachments with `nosniff` and a sandbox CSP.
