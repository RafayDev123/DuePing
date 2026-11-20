# API (v1)

Base `/api/v1`. Cookie session (`dp_session`, HttpOnly, SameSite=Lax). Mutations from browsers must be same-origin (Origin check). Every response: `{ ok, data, requestId }` or `{ ok:false, error:{code,message,details?}, requestId }` plus `x-request-id`. Status codes: 200/201, 400, 401, 403, 404, 409, 413, 415, 422 (Zod), 429 (+`retry-after`), 500/502. Workspace comes from the verified session (never from the request body). Roles: see `src/lib/permissions.ts`.

| Method & path | Purpose | Permission |
| --- | --- | --- |
| POST `/auth/signup` `/auth/login` `/auth/logout` `/auth/forgot` `/auth/reset` `/auth/verify` | account lifecycle (rate limited) | public |
| POST `/workspaces` · POST `/workspaces/switch` | create / switch business | user |
| GET, PATCH `/workspace/settings` · GET `/workspace/export` · DELETE `/workspace` · POST, DELETE `/workspace/demo` | settings, data export, deletion, demo data | read / settings.manage / owner |
| GET, POST `/team` · PATCH, DELETE `/team/:id` · DELETE `/team/invites/:id` · POST `/invites/accept` | members & invitations | team.manage |
| GET, PUT, DELETE `/integrations/email` · POST `/integrations/email/test` | email provider (key encrypted) | settings.manage |
| GET, POST `/clients` · GET, PATCH, DELETE `/clients/:id` · POST `/clients/:id/notes` · GET `/clients/export` | clients (DELETE = archive) | read / clients.write |
| GET, POST `/invoices` · GET, PATCH `/invoices/:id` | list (filters/sort/pagination) · create · read · edit draft or `{dueDate}` | read / invoices.write |
| POST `/invoices/:id/send` `/duplicate` `/void` `/mark-sent` `/archive` `/link` `/whatsapp` `/attachments` · DELETE `/invoices/:id/link` · GET `/invoices/:id/pdf` | invoice actions | invoices.write (pdf: read) |
| POST `/invoices/bulk` | mark_sent / archive / restore (≤200) | invoices.write |
| POST `/invoices/import/csv` (`preview|validate|commit`) · POST `/invoices/import/pdf` · POST `/invoices/import/pdf/confirm` | imports (review required) | import.run |
| GET `/files/:id` | private file download | read |
| GET, POST `/payments` · GET `/payments/:id` · POST `/payments/:id/reverse` `/payments/:id/correct` | ledger | read / payments.write |
| GET `/payment-requests` · POST `/payment-requests/:id/review` | client payment reports: under_review / approve / reject | payments.write |
| GET `/reminders` · PATCH `/reminders/:id` · POST `/reminders/:id/pause` `/resume` `/retry` | schedules | reminders.manage |
| GET, POST `/reminders/rules` · PATCH, DELETE `/reminders/rules/:id` | rules | reminders.manage |
| GET, POST `/reminders/settings` | checklist / enable / disable | reminders.manage |
| GET, PUT, DELETE `/reminders/templates` · POST `/reminders/test-send` | templates | reminders.manage |
| GET, POST `/recurring` · PATCH, DELETE `/recurring/:id` | recurring drafts | invoices.write |
| GET `/reports/summary` `/reports/outstanding` `/reports/overdue` `/reports/export?type=&format=csv|xlsx|pdf` | reports | read |
| GET `/dashboard/overview` | dashboard data | read |
| GET, POST `/notifications` | list / mark read | read |
| POST `/contact` | marketing contact form | public |
| POST `/webhooks/resend` | signed delivery events (Svix HMAC) | signature |
| POST `/api/internal/run` | run one worker cycle (`Authorization: Bearer $CRON_SECRET`) | secret |
| POST `/api/portal/:token/report` | client reports a payment (verification request only) | token |
| GET `/portal/:token`, `/portal/:token/pdf` | client portal | token |

Rate limits (per user or IP, Postgres-backed fixed window): default 300/min authenticated, 60/min public; stricter on login, signup, reset, contact, portal reports, link creation, email sends and exports.
