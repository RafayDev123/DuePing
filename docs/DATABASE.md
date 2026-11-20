# Database

PostgreSQL via Drizzle (`src/db/schema.ts`). Apply with `npx drizzle-kit push` or `npx drizzle-kit generate` → SQL in `drizzle/`. All tenant tables have `workspace_id` (FK, `ON DELETE CASCADE`), UUID primary keys, indexes on workspace, invoice, client, due date, status, created_at and reminder `(status, scheduled_at)`.

```
users ─< sessions            users ─< auth_tokens
users ─< workspace_members >─ workspaces ─1 business_settings / subscriptions
workspaces ─< workspace_invites, clients, invoices, payments, reminder_rules, reminder_templates,
              reminder_schedules, reminder_events, communication_integrations, email_deliveries,
              messaging_deliveries, portal_access_tokens, notifications, audit_logs, recurring_invoices, files
clients ─< client_notes          clients ─< invoices ─< invoice_items
invoices ─< payments (kind payment|reversal, reverses_payment_id UNIQUE, corrects_payment_id)
invoices ─< payment_verification_requests ─? files
invoices ─< reminder_schedules >─ reminder_rules ;  reminder_schedules ─< email_deliveries
portal_access_tokens ─< portal_access_events
platform: rate_limits, system_errors, worker_heartbeats, contact_messages, invoice_sequences
```

* Money columns are `NUMERIC(20,4)`; currency is a 3-letter ISO code; `invoices (workspace_id, number)` is unique.
* `invoice_sequences(workspace_id, year)` is incremented with `INSERT … ON CONFLICT DO UPDATE` (row-locked, concurrency-safe).
* `payments` rows are never updated or deleted by the app.
* **Not implemented from the brief**: `payment_allocations` (1 payment = 1 invoice), `api_keys`, `usage_events`, `report_jobs`, `export_jobs`, `idempotency_keys`, `profiles`, `user_preferences`, `client_contacts`, `generated_reports`, `payment_attachments` (proof files use `files`), `notification_preferences`.
* **RLS**: not used (no Supabase). See SECURITY.md.
* **Seed**: `npm run seed -- you@example.com` or the in-app *Load demo data* button (rows are flagged `is_demo` and prefixed “[Demo]”).
* Backup/recovery: `pg_dump -Fc "$DATABASE_URL" > dueping.dump`; restore with `pg_restore -d NEWDB dueping.dump`. Schedule daily dumps and test restores; files live in the same database.
