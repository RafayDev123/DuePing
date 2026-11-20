import { addDays, applyQuietHours, inQuietHours, isYmd, todayInTz, addMonths } from "@/lib/dates";
import { audit, notify } from "@/lib/audit";
import { getWorkspaceEmailConfig } from "@/lib/email";
import { appUrlFromEnv, whatsappApiConfigured } from "@/lib/env";
import { fromMinor, toMinor } from "@/lib/money";
import { one, rows, sql } from "@/lib/sql";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { deliverEmail } from "@/services/integrations";
import { createInvoice } from "@/services/invoices";
import { createPortalLink } from "@/services/portal";
import { composeMessage } from "@/services/reminders";
import { getSettings } from "@/services/workspace";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

interface Claimed {
  id: string; workspace_id: string; invoice_id: string; client_id: string; channel: string; language: string; template_key: string;
  idempotency_key: string; attempts: number; max_attempts: number;
}

async function log(wsId: string, scheduleId: string, invoiceId: string, type: string, detail?: string) {
  await rows(sql`insert into reminder_events (workspace_id, schedule_id, invoice_id, type, detail) values (${wsId}, ${scheduleId}, ${invoiceId}, ${type}, ${detail ?? null})`);
}

async function finish(s: Claimed, status: string, patch: { error?: string | null; reason?: string | null; sent?: boolean; at?: Date; attemptsBack?: boolean } = {}) {
  await rows(sql`update reminder_schedules set status = ${status}, last_error = ${patch.error ?? null}, cancel_reason = ${patch.reason ?? null},
    sent_at = ${patch.sent ? sql`now()` : sql`sent_at`}, scheduled_at = ${patch.at ? patch.at.toISOString() : sql`scheduled_at`},
    attempts = ${patch.attemptsBack ? sql`greatest(attempts - 1, 0)` : sql`attempts`}, updated_at = now() where id = ${s.id}`);
}

/** Processes one claimed reminder. Every guard below re-validates invoice state at send time. */
async function processOne(s: Claimed): Promise<"sent" | "failed" | "skipped" | "retry" | "deferred" | "action_needed" | "cancelled"> {
  const wsId = s.workspace_id;
  const settings = await getSettings(wsId);
  const r = await one<{
    status: string; due_date: string; currency: string; total: string; number: string; archived_at: Date | null; paid: string | null;
    c_name: string; c_email: string | null; c_phone: string | null; c_paused: boolean; c_archived: Date | null; c_consent: Date | null; rule_id: string | null;
  }>(sql`select i.status, i.due_date, i.currency, i.total, i.number, i.archived_at, (select sum(amount) from payments where invoice_id = i.id) as paid,
      c.name as c_name, c.email as c_email, c.phone as c_phone, c.reminders_paused as c_paused, c.archived_at as c_archived, c.whatsapp_consent_at as c_consent, s.rule_id
    from reminder_schedules s join invoices i on i.id = s.invoice_id join clients c on c.id = s.client_id where s.id = ${s.id}`);
  if (!r) { await finish(s, "cancelled", { reason: "invoice_missing" }); return "cancelled"; }

  const balance = toMinor(r.total, r.currency) - toMinor(r.paid ?? "0", r.currency);
  const expectedKey = `${s.invoice_id}:${r.rule_id}:${r.due_date}`;
  if (!settings.autoRemindersEnabled) { await finish(s, "cancelled", { reason: "auto_disabled" }); await log(wsId, s.id, s.invoice_id, "cancelled", "automatic reminders are off"); return "cancelled"; }
  if (r.status !== "sent") { await finish(s, "cancelled", { reason: r.status }); await log(wsId, s.id, s.invoice_id, "cancelled", `invoice is ${r.status}`); return "cancelled"; }
  if (balance <= BigInt(0)) { await finish(s, "cancelled", { reason: "paid" }); await log(wsId, s.id, s.invoice_id, "cancelled", "invoice is paid"); return "cancelled"; }
  if (r.archived_at || r.c_archived) { await finish(s, "cancelled", { reason: "archived" }); return "cancelled"; }
  if (expectedKey !== s.idempotency_key) { await finish(s, "cancelled", { reason: "due_date_changed" }); await log(wsId, s.id, s.invoice_id, "cancelled", "due date changed"); return "cancelled"; }
  if (r.c_paused) { await finish(s, "skipped", { reason: "client_paused" }); await log(wsId, s.id, s.invoice_id, "skipped", "reminders paused for client"); return "skipped"; }

  const now = new Date();
  if (inQuietHours(now, settings.timezone, settings.quietStart, settings.quietEnd)) {
    const at = applyQuietHours(now, settings.timezone, settings.quietStart, settings.quietEnd);
    await finish(s, "pending", { at, attemptsBack: true });
    await log(wsId, s.id, s.invoice_id, "deferred", "quiet hours");
    return "deferred";
  }

  const today = todayInTz(settings.timezone);
  const daysOverdue = Math.max(0, Math.round((Date.parse(today) - Date.parse(r.due_date)) / 86400000));
  const link = await createPortalLink(wsId, s.invoice_id, null, 60, appUrlFromEnv());
  const balStr = fromMinor(balance, r.currency);
  const precise = await composeMessage(wsId, settings, s.template_key, s.language, {
    clientName: r.c_name, invoiceNumber: r.number, currency: r.currency, balance: balStr, total: r.total, dueDate: r.due_date, daysOverdue, link: link.url,
  });

  if (s.channel === "whatsapp") {
    if (whatsappApiConfigured() && r.c_consent && r.c_phone) {
      const res = await sendWhatsAppTemplate(r.c_phone, [r.c_name, r.number, formatMoney(balStr, r.currency), formatDate(r.due_date)], "en");
      await rows(sql`insert into messaging_deliveries (workspace_id, invoice_id, client_id, channel, mode, status, detail) values (${wsId}, ${s.invoice_id}, ${s.client_id}, 'whatsapp', 'business_api', ${res.ok ? "api_accepted" : "failed"}, ${res.messageId ?? res.error ?? null})`);
      if (res.ok) { await finish(s, "sent", { sent: true }); await log(wsId, s.id, s.invoice_id, "sent", "WhatsApp API accepted (delivery not confirmed)"); return "sent"; }
      await finish(s, "failed", { error: res.error });
      return "failed";
    }
    await finish(s, "action_needed", {});
    await log(wsId, s.id, s.invoice_id, "action_needed", "WhatsApp follow-up is ready for you to send manually");
    await notify(wsId, "reminder_action", `WhatsApp follow-up due for ${r.number}`, { body: `${r.c_name} — open the invoice and use the WhatsApp button to review and send.`, link: `/app/invoices/${s.invoice_id}`, dedupeKey: `wa-action:${s.id}` });
    return "action_needed";
  }

  const cfg = await getWorkspaceEmailConfig(wsId);
  if (!cfg || !cfg.verified) { await finish(s, "failed", { error: "Email provider is not configured or verified" }); await log(wsId, s.id, s.invoice_id, "failed", "email provider not ready"); await notify(wsId, "reminder_failed", `Reminder failed for ${r.number}`, { body: "Email provider is not configured or verified.", link: "/app/reminders", dedupeKey: `rf:${s.id}:${s.attempts}` }); return "failed"; }
  if (!r.c_email) { await finish(s, "failed", { error: "Client has no email address" }); await log(wsId, s.id, s.invoice_id, "failed", "no email"); await notify(wsId, "reminder_failed", `Reminder failed for ${r.number}`, { body: `${r.c_name} has no email address.`, link: `/app/invoices/${s.invoice_id}`, dedupeKey: `rf:${s.id}:${s.attempts}` }); return "failed"; }

  const res = await deliverEmail(wsId, cfg, { to: r.c_email, subject: precise.subject, text: precise.text, html: precise.html, kind: "reminder", invoiceId: s.invoice_id, scheduleId: s.id, idempotencyKey: s.idempotency_key });
  if (res.ok) {
    await finish(s, "sent", { sent: true });
    await log(wsId, s.id, s.invoice_id, "sent", "Provider accepted the message (delivery status updates via webhook)");
    await notify(wsId, "reminder_sent", `Reminder sent for ${r.number}`, { body: `Sent to ${r.c_email}. Provider accepted; final delivery status arrives via webhook.`, link: `/app/invoices/${s.invoice_id}`, dedupeKey: `rs:${s.id}` });
    return "sent";
  }
  if (res.retryable && s.attempts < s.max_attempts) {
    const backoffMin = 5 * Math.pow(4, s.attempts - 1);
    await finish(s, "pending", { error: res.error, at: new Date(Date.now() + backoffMin * 60000) });
    await log(wsId, s.id, s.invoice_id, "retry_scheduled", `${res.error} — retry in ${backoffMin} min`);
    return "retry";
  }
  await finish(s, "failed", { error: res.error });
  await log(wsId, s.id, s.invoice_id, "failed", res.error);
  await notify(wsId, "reminder_failed", `Reminder failed for ${r.number}`, { body: res.error, link: "/app/reminders", dedupeKey: `rf:${s.id}:${s.attempts}` });
  return "failed";
}

/** Claims due reminders with FOR UPDATE SKIP LOCKED so multiple workers never process the same row. */
export async function processDueReminders(limit = 25) {
  await rows(sql`update reminder_schedules set status = 'pending', updated_at = now() where status = 'processing' and updated_at < now() - interval '10 minutes'`);
  const claimed = await rows<Claimed>(sql`update reminder_schedules set status = 'processing', attempts = attempts + 1, updated_at = now()
    where id in (select id from reminder_schedules where status = 'pending' and scheduled_at <= now() order by scheduled_at asc limit ${limit} for update skip locked)
    returning id, workspace_id, invoice_id, client_id, channel, language, template_key, idempotency_key, attempts, max_attempts`);
  const stats: Record<string, number> = { claimed: claimed.length };
  for (const c of claimed) {
    try {
      const out = await processOne(c);
      stats[out] = (stats[out] ?? 0) + 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      stats.errors = (stats.errors ?? 0) + 1;
      await rows(sql`update reminder_schedules set status = ${c.attempts >= c.max_attempts ? "failed" : "pending"}, last_error = ${msg.slice(0, 300)}, scheduled_at = now() + interval '10 minutes', updated_at = now() where id = ${c.id}`);
    }
  }
  return stats;
}

/** Recurring invoices (always created as drafts) + due-soon / overdue in-app notifications. */
export async function runMaintenance() {
  const stats = { recurring: 0, notifications: 0 };
  const due = await rows<{ id: string; workspace_id: string; client_id: string; title: string | null; currency: string; items: { description: string; quantity: string; unitPrice: string }[]; discount_type: string; discount_value: string; tax_rate: string; payment_terms_days: number; notes: string | null; frequency: string; interval_days: number | null; next_run_date: string; end_date: string | null; created_by: string | null }>(sql`
    select id, workspace_id, client_id, title, currency, items, discount_type, discount_value, tax_rate, payment_terms_days, notes, frequency, interval_days, next_run_date, end_date, created_by
    from recurring_invoices where active and next_run_date <= (now() at time zone 'UTC')::date + 1`);
  for (const r of due) {
    try {
      const s = await getSettings(r.workspace_id);
      const today = todayInTz(s.timezone);
      if (r.next_run_date > today) continue;
      const claim = await one(sql`update recurring_invoices set last_run_at = now() where id = ${r.id} and next_run_date = ${r.next_run_date} returning id`);
      if (!claim) continue;
      const inv = await createInvoice(r.workspace_id, r.created_by, {
        clientId: r.client_id, title: r.title, number: null, currency: r.currency, issueDate: r.next_run_date, dueDate: addDays(r.next_run_date, r.payment_terms_days), items: r.items,
        discountType: r.discount_type as "none", discountValue: r.discount_value, taxRate: r.tax_rate, paymentTerms: null, notes: r.notes, internalNotes: null, status: "draft",
      }, { recurringId: r.id });
      let next = r.next_run_date;
      const step = (d: string) => r.frequency === "weekly" ? addDays(d, 7) : r.frequency === "monthly" ? addMonths(d, 1) : r.frequency === "quarterly" ? addMonths(d, 3) : r.frequency === "yearly" ? addMonths(d, 12) : addDays(d, Math.max(1, r.interval_days ?? 30));
      next = step(next);
      const active = !(r.end_date && isYmd(r.end_date) && next > r.end_date);
      await rows(sql`update recurring_invoices set next_run_date = ${next}, active = ${active} where id = ${r.id}`);
      await notify(r.workspace_id, "recurring_created", `Recurring invoice ${inv.number} created as draft`, { body: "Review and send it when you're ready.", link: `/app/invoices/${inv.id}`, dedupeKey: `rec:${r.id}:${r.next_run_date}` });
      await audit(r.workspace_id, null, "recurring.created_invoice", "invoice", inv.id);
      stats.recurring++;
    } catch (e) {
      console.error("recurring failed", e);
    }
  }
  // Due soon / overdue in-app notifications (deduplicated per invoice + due date)
  const soon = await rows<{ id: string; workspace_id: string; number: string; due_date: string; kind: string }>(sql`
    select i.id, i.workspace_id, i.number, i.due_date::text as due_date,
      case when i.due_date < (now() at time zone s.timezone)::date then 'overdue' else 'due_soon' end as kind
    from invoices i join business_settings s on s.workspace_id = i.workspace_id
    where i.status = 'sent' and i.archived_at is null and i.total - coalesce((select sum(amount) from payments where invoice_id = i.id),0) > 0
      and i.due_date <= (now() at time zone s.timezone)::date + 3 limit 500`);
  for (const i of soon) {
    await notify(i.workspace_id, i.kind === "overdue" ? "overdue" : "due_soon", i.kind === "overdue" ? `Invoice ${i.number} is overdue` : `Invoice ${i.number} is due soon`, { body: `Due ${formatDate(i.due_date)}`, link: `/app/invoices/${i.id}`, dedupeKey: `${i.kind}:${i.id}:${i.due_date}` });
    stats.notifications++;
  }
  return stats;
}

export async function runWorkerCycle() {
  const reminders = await processDueReminders();
  const maintenance = await runMaintenance();
  await rows(sql`insert into worker_heartbeats (name, last_run_at, last_status, stats) values ('main', now(), 'ok', ${JSON.stringify({ reminders, maintenance })}::jsonb)
    on conflict (name) do update set last_run_at = now(), last_status = 'ok', stats = excluded.stats`);
  return { reminders, maintenance };
}
