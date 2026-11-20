# Changelog

## 1.0.0 — 2026-03-01
Initial release.

- Workspaces, roles (owner/admin/accountant/member/viewer), audit log, notifications.
- Clients, invoices (exact decimal totals, configurable numbering, PDF, print, private links, attachments, recurring drafts).
- Append-only payment ledger with partial payments, reversal, correction and client payment-report verification.
- Reminder rules, EN/UR/Roman-Urdu templates, quiet hours, safety checklist, idempotent PostgreSQL-backed worker.
- WhatsApp click-to-chat and optional Business API adapter (untested without credentials).
- Dashboard, 8 reports with CSV/XLSX/PDF export, CSV and PDF import with review.
- Client portal with hashed, expiring, revocable tokens.
- Public website with SEO/AEO/GEO structured data, admin panel.
- Vitest unit/integration suite and HTTP smoke script.

Known limitations: no RLS (service-layer isolation), no Redis/BullMQ, no OCR, no billing provider, no Playwright/Sentry.
