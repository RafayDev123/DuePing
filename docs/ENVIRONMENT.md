# Environment variables

See `.env.example` (only variables the code reads). 

| Variable | Required | Used by |
| --- | --- | --- |
| `DATABASE_URL` | yes | db pool, drizzle-kit (`drizzle.config.json` has a local default for `push`) |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | yes (prod) | links in emails/worker, metadata, sitemap |
| `APP_ENCRYPTION_KEY` | yes | AES-GCM for integration keys, IP hashing salt |
| `CRON_SECRET` | if using `/api/internal/run` | scheduler trigger |
| `EMBEDDED_WORKER`, `WORKER_INTERVAL_MS` | no | worker mode / interval |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | no | platform emails (verification, reset); enables mandatory verification |
| `AUTH_DEV_LINKS` | dev only | show verify/reset links when no mailer |
| `ADMIN_EMAILS` | no | extra platform admins at signup |
| `RESEND_WEBHOOK_SECRET` | no | delivery webhook verification |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_TEMPLATE_NAME` | no | Business API adapter (all required together) |
| `OCR_API_KEY` | no | reserved; OCR not implemented |

Variables from the brief that are **not** used because the corresponding service is not part of this build: `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `SENTRY_DSN`, `BILLING_*`, `APP_ENCRYPTION_KEY_VERSION`.
