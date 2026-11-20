# Testing

| Layer | Command | Covers |
| --- | --- | --- |
| Unit | `npm test` | money & decimals, totals/tax/discount, invoice numbering, derived status, timezones & quiet hours, templates (3 languages, tone, escaping), CSV parsing & injection, import mapping/extraction, upload validation, crypto, PDF generation incl. pagination & non-Latin text, WhatsApp links, role matrix |
| Integration (real PostgreSQL) | `npm test` | sequential + concurrent invoice numbers, duplicate rejection, partial payments (500−150−200=150), overpayment, void-with-payments blocked, reversal + correction history, multi-currency, cross-workspace isolation, reminder scheduling (off by default, idempotent, recalculated on due-date change, cancelled on payment, revived on reversal), worker suppression of paid invoices and honest failure without a provider, portal token hashing/expiry/revocation/internal-note hiding, payment reports never marking paid |
| HTTP smoke | `BASE=… bash tests/smoke.sh` | health, public pages, signup, 401 on anonymous API, client → invoice → payment → overpayment → PDF → portal (noindex, revoke) → dashboard → XLSX |
| Static | `npx tsc --noEmit` · `npm run lint` · `npm run build` | types, lint (React 19 rules), production build |

**Not covered / not run**: Playwright E2E (not installed), real email/WhatsApp provider calls (need your credentials), visual regression, load tests, automated accessibility scans. UI was manually verified server-side (all authenticated pages return 200 with demo data); responsive layouts are built mobile-first (drawer nav, card lists under 768 px) but were not screenshot-tested on devices here.
