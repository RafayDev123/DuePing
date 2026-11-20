import { db } from "@/db";
import { ApiError, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { addDays, applyQuietHours, formatDate, zonedToUtc } from "@/lib/dates";
import { formatMoney, toMinor } from "@/lib/money";
import { DEFAULT_TEMPLATES, renderEmailHtml, renderTemplate, TEMPLATE_KEYS, type Language, type Template, type TemplateKey } from "@/lib/reminder-templates";
import { one, rows, sql } from "@/lib/sql";
import { getSettings, type Settings } from "@/services/workspace";

export const RULE_LANGUAGES = ["client", "en", "ur", "roman_ur"];

/* ───────────── Rules ───────────── */

export interface RuleRow { id: string; name: string; offset_days: number; channel: string; language: string; template_key: string; enabled: boolean }

export async function listRules(wsId: string) {
  return rows<RuleRow>(sql`select id, name, offset_days, channel, language, template_key, enabled from reminder_rules where workspace_id = ${wsId} order by offset_days asc, created_at asc`);
}

export async function createRule(wsId: string, userId: string, r: { name: string; offsetDays: number; channel: string; language: string; templateKey: string; enabled: boolean }) {
  const row = await one<{ id: string }>(sql`insert into reminder_rules (workspace_id, name, offset_days, channel, language, template_key, enabled)
    values (${wsId}, ${r.name}, ${r.offsetDays}, ${r.channel}, ${r.language}, ${r.templateKey}, ${r.enabled}) returning id`);
  await audit(wsId, userId, "reminder_rule.created", "reminder_rule", row!.id);
  await resyncWorkspace(wsId);
  return row!;
}

export async function updateRule(wsId: string, userId: string, id: string, r: Partial<{ name: string; offsetDays: number; channel: string; language: string; templateKey: string; enabled: boolean }>) {
  const cur = await one<RuleRow>(sql`select id, name, offset_days, channel, language, template_key, enabled from reminder_rules where id = ${id} and workspace_id = ${wsId}`);
  if (!cur) throw notFound("Reminder rule");
  await rows(sql`update reminder_rules set name = ${r.name ?? cur.name}, offset_days = ${r.offsetDays ?? cur.offset_days}, channel = ${r.channel ?? cur.channel},
    language = ${r.language ?? cur.language}, template_key = ${r.templateKey ?? cur.template_key}, enabled = ${r.enabled ?? cur.enabled} where id = ${id}`);
  await audit(wsId, userId, "reminder_rule.updated", "reminder_rule", id);
  await resyncWorkspace(wsId);
}

export async function deleteRule(wsId: string, userId: string, id: string) {
  const r = await one(sql`delete from reminder_rules where id = ${id} and workspace_id = ${wsId} returning id`);
  if (!r) throw notFound("Reminder rule");
  await audit(wsId, userId, "reminder_rule.deleted", "reminder_rule", id);
  await resyncWorkspace(wsId);
}

/* ───────────── Schedules ───────────── */

const HOUR = 3600_000;

/**
 * Reconciles pending schedules for one invoice with the workspace rules. Idempotent: the idempotency key is
 * invoice + rule + due date, so a changed due date produces new keys and cancels the old ones.
 */
export async function syncInvoiceSchedules(wsId: string, invoiceId: string) {
  const s = await getSettings(wsId);
  const inv = await one<{ status: string; due_date: string; client_id: string; archived_at: Date | null; total: string; currency: string; paid: string | null; paused: boolean; client_language: string; archived_client: Date | null }>(sql`
    select i.status, i.due_date, i.client_id, i.archived_at, i.total, i.currency, (select sum(amount) from payments where invoice_id = i.id) as paid,
      c.reminders_paused as paused, c.language as client_language, c.archived_at as archived_client
    from invoices i join clients c on c.id = i.client_id where i.id = ${invoiceId} and i.workspace_id = ${wsId}`);
  if (!inv) return;
  const balance = toMinor(inv.total, inv.currency) - toMinor(inv.paid ?? "0", inv.currency);
  let reason: string | null = null;
  if (!s.autoRemindersEnabled) reason = "auto_disabled";
  else if (inv.status !== "sent") reason = inv.status;
  else if (inv.archived_at || inv.archived_client) reason = "archived";
  else if (balance <= BigInt(0)) reason = "paid";
  else if (inv.paused) reason = "client_paused";

  const keep: string[] = [];
  if (!reason) {
    const rules = await rows<RuleRow>(sql`select id, name, offset_days, channel, language, template_key, enabled from reminder_rules where workspace_id = ${wsId} and enabled`);
    for (const rule of rules) {
      const day = addDays(inv.due_date, rule.offset_days);
      const at = applyQuietHours(zonedToUtc(day, s.reminderSendHour, 0, s.timezone), s.timezone, s.quietStart, s.quietEnd);
      if (at.getTime() < Date.now() - 12 * HOUR) continue; // never backfill old reminders
      const key = `${invoiceId}:${rule.id}:${inv.due_date}`;
      const language = rule.language === "client" ? inv.client_language : rule.language;
      keep.push(key);
      await rows(sql`insert into reminder_schedules (workspace_id, invoice_id, client_id, rule_id, scheduled_at, channel, language, template_key, idempotency_key)
        values (${wsId}, ${invoiceId}, ${inv.client_id}, ${rule.id}, ${at.toISOString()}, ${rule.channel}, ${language}, ${rule.template_key}, ${key})
        on conflict (idempotency_key) do update set
          status = 'pending', scheduled_at = excluded.scheduled_at, cancel_reason = null, language = excluded.language, channel = excluded.channel,
          template_key = excluded.template_key, attempts = case when reminder_schedules.status = 'cancelled' then 0 else reminder_schedules.attempts end, updated_at = now()
        where reminder_schedules.status in ('cancelled', 'pending')`);
    }
  }
  await rows(sql`update reminder_schedules set status = 'cancelled', cancel_reason = ${reason ?? "recalculated"}, updated_at = now()
    where invoice_id = ${invoiceId} and status in ('pending', 'paused', 'action_needed')
    ${keep.length ? sql`and idempotency_key not in (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})` : sql``}`);
}

export async function cancelInvoiceSchedules(wsId: string, invoiceId: string, reason: string) {
  await rows(sql`update reminder_schedules set status = 'cancelled', cancel_reason = ${reason}, updated_at = now()
    where workspace_id = ${wsId} and invoice_id = ${invoiceId} and status in ('pending', 'paused', 'action_needed')`);
}

export async function cancelClientSchedules(wsId: string, clientId: string, reason: string) {
  await rows(sql`update reminder_schedules set status = 'cancelled', cancel_reason = ${reason}, updated_at = now()
    where workspace_id = ${wsId} and client_id = ${clientId} and status in ('pending', 'paused', 'action_needed')`);
}

export async function resyncWorkspace(wsId: string) {
  const s = await getSettings(wsId);
  if (!s.autoRemindersEnabled) return;
  const ids = await rows<{ id: string }>(sql`select id from invoices where workspace_id = ${wsId} and status = 'sent' and archived_at is null limit 3000`);
  for (const i of ids) await syncInvoiceSchedules(wsId, i.id);
}

export interface ScheduleRow {
  id: string; invoice_id: string; invoice_number: string; client_name: string; due_date: string; scheduled_at: Date; channel: string; language: string;
  template_key: string; status: string; attempts: number; last_error: string | null; sent_at: Date | null; cancel_reason: string | null;
  delivery_status: string | null; delivery_error: string | null; rule_name: string | null;
}

export async function listSchedules(wsId: string, group: "upcoming" | "sent" | "failed" | "all", invoiceId?: string) {
  const statuses =
    group === "upcoming" ? sql`s.status in ('pending','paused','processing','action_needed')` : group === "sent" ? sql`s.status = 'sent'` : group === "failed" ? sql`s.status = 'failed'` : sql`true`;
  return rows<ScheduleRow>(sql`select s.id, s.invoice_id, i.number as invoice_number, c.name as client_name, i.due_date, s.scheduled_at, s.channel, s.language, s.template_key,
      s.status, s.attempts, s.last_error, s.sent_at, s.cancel_reason, rr.name as rule_name,
      (select d.status from email_deliveries d where d.schedule_id = s.id order by d.created_at desc limit 1) as delivery_status,
      (select d.error from email_deliveries d where d.schedule_id = s.id order by d.created_at desc limit 1) as delivery_error
    from reminder_schedules s join invoices i on i.id = s.invoice_id join clients c on c.id = s.client_id left join reminder_rules rr on rr.id = s.rule_id
    where s.workspace_id = ${wsId} and ${statuses} ${invoiceId ? sql`and s.invoice_id = ${invoiceId}` : sql``}
    order by ${group === "upcoming" ? sql`s.scheduled_at asc` : sql`s.scheduled_at desc`} limit 300`);
}

export async function pauseSchedule(wsId: string, userId: string, id: string) {
  const r = await one(sql`update reminder_schedules set status = 'paused', updated_at = now() where id = ${id} and workspace_id = ${wsId} and status in ('pending','action_needed') returning id`);
  if (!r) throw new ApiError(409, "invalid_state", "Only upcoming reminders can be paused");
  await audit(wsId, userId, "reminder.paused", "reminder_schedule", id);
}

export async function resumeSchedule(wsId: string, userId: string, id: string) {
  const r = await one(sql`update reminder_schedules set status = 'pending', updated_at = now() where id = ${id} and workspace_id = ${wsId} and status = 'paused' returning id`);
  if (!r) throw new ApiError(409, "invalid_state", "Only paused reminders can be resumed");
  await audit(wsId, userId, "reminder.resumed", "reminder_schedule", id);
}

export async function rescheduleReminder(wsId: string, userId: string, id: string, at: Date) {
  const s = await getSettings(wsId);
  const adjusted = applyQuietHours(at, s.timezone, s.quietStart, s.quietEnd);
  const r = await one(sql`update reminder_schedules set scheduled_at = ${adjusted.toISOString()}, updated_at = now() where id = ${id} and workspace_id = ${wsId} and status in ('pending','paused') returning id`);
  if (!r) throw new ApiError(409, "invalid_state", "Only upcoming or paused reminders can be rescheduled");
  await audit(wsId, userId, "reminder.rescheduled", "reminder_schedule", id, { at: adjusted.toISOString() });
}

/** Retry a failed reminder. Safe because the idempotency key is forwarded to the provider. */
export async function retryReminder(wsId: string, userId: string, id: string) {
  const cur = await one<{ invoice_id: string }>(sql`select invoice_id from reminder_schedules where id = ${id} and workspace_id = ${wsId} and status = 'failed'`);
  if (!cur) throw new ApiError(409, "invalid_state", "Only failed reminders can be retried");
  const inv = await one<{ status: string }>(sql`select status from invoices where id = ${cur.invoice_id}`);
  if (inv?.status !== "sent") throw new ApiError(409, "invalid_state", "Invoice is no longer open");
  await rows(sql`update reminder_schedules set status = 'pending', attempts = 0, last_error = null, scheduled_at = now(), updated_at = now() where id = ${id}`);
  await audit(wsId, userId, "reminder.retried", "reminder_schedule", id);
}

/* ───────────── Auto-reminder safety checklist ───────────── */

export interface Checklist {
  providerConfigured: boolean;
  senderVerified: boolean;
  templatesReviewed: boolean;
  preferencesConfirmed: boolean;
  enabled: boolean;
}

export async function getChecklist(wsId: string): Promise<Checklist> {
  const s = await getSettings(wsId);
  const integ = await one<{ verified_at: Date | null }>(sql`select verified_at from communication_integrations where workspace_id = ${wsId} and kind = 'email'`);
  return {
    providerConfigured: !!integ,
    senderVerified: !!integ?.verified_at,
    templatesReviewed: !!s.templatesReviewedAt,
    preferencesConfirmed: !!s.preferencesConfirmedAt,
    enabled: s.autoRemindersEnabled,
  };
}

export async function confirmChecklistItem(wsId: string, userId: string, item: "templates" | "preferences") {
  await rows(sql`update business_settings set ${item === "templates" ? sql`templates_reviewed_at` : sql`preferences_confirmed_at`} = now() where workspace_id = ${wsId}`);
  await audit(wsId, userId, `reminders.confirm_${item}`, "workspace", wsId);
}

export async function setAutoReminders(wsId: string, userId: string, on: boolean) {
  if (on) {
    const c = await getChecklist(wsId);
    const missing = [!c.providerConfigured && "configure the email provider", !c.senderVerified && "verify the sending identity with a test email", !c.templatesReviewed && "review the reminder templates", !c.preferencesConfirmed && "confirm communication preferences"].filter(Boolean);
    if (missing.length) throw new ApiError(409, "checklist_incomplete", `Before enabling automatic reminders you need to: ${missing.join(", ")}.`);
  }
  await rows(sql`update business_settings set auto_reminders_enabled = ${on} where workspace_id = ${wsId}`);
  await audit(wsId, userId, on ? "reminders.enabled" : "reminders.disabled", "workspace", wsId);
  if (on) await resyncWorkspace(wsId);
  else
    await rows(sql`update reminder_schedules set status = 'cancelled', cancel_reason = 'auto_disabled', updated_at = now() where workspace_id = ${wsId} and status in ('pending','paused','action_needed')`);
}

/* ───────────── Templates & composition ───────────── */

export async function getTemplates(wsId: string): Promise<Record<string, Template & { custom: boolean }>> {
  const custom = await rows<{ template_key: string; language: string; subject: string; body: string }>(sql`select template_key, language, subject, body from reminder_templates where workspace_id = ${wsId}`);
  const out: Record<string, Template & { custom: boolean }> = {};
  for (const k of TEMPLATE_KEYS) {
    for (const l of ["en", "ur", "roman_ur"] as Language[]) {
      const c = custom.find((x) => x.template_key === k && x.language === l);
      out[`${k}:${l}`] = c ? { subject: c.subject, body: c.body, custom: true } : { ...DEFAULT_TEMPLATES[k][l], custom: false };
    }
  }
  return out;
}

export async function saveTemplate(wsId: string, userId: string, key: string, language: string, subject: string, body: string) {
  if (!TEMPLATE_KEYS.includes(key as TemplateKey) || !["en", "ur", "roman_ur"].includes(language)) throw new ApiError(422, "validation_failed", "Unknown template");
  await rows(sql`insert into reminder_templates (workspace_id, template_key, language, subject, body) values (${wsId}, ${key}, ${language}, ${subject}, ${body})
    on conflict (workspace_id, template_key, language) do update set subject = excluded.subject, body = excluded.body, updated_at = now()`);
  // Editing a template invalidates the earlier review.
  await rows(sql`update business_settings set templates_reviewed_at = null where workspace_id = ${wsId}`);
  await audit(wsId, userId, "reminder_template.saved", "reminder_template", `${key}:${language}`);
}

export async function resetTemplate(wsId: string, userId: string, key: string, language: string) {
  await rows(sql`delete from reminder_templates where workspace_id = ${wsId} and template_key = ${key} and language = ${language}`);
  await rows(sql`update business_settings set templates_reviewed_at = null where workspace_id = ${wsId}`);
  await audit(wsId, userId, "reminder_template.reset", "reminder_template", `${key}:${language}`);
}

export interface ComposeData {
  clientName: string;
  invoiceNumber: string;
  currency: string;
  balance: string;
  total: string;
  dueDate: string;
  daysOverdue: number;
  link: string;
}

export async function composeMessage(wsId: string, s: Settings, key: string, language: string, d: ComposeData) {
  const lang = (["en", "ur", "roman_ur"].includes(language) ? language : "en") as Language;
  const k = (TEMPLATE_KEYS.includes(key as TemplateKey) ? key : "due_today") as TemplateKey;
  const custom = await one<{ subject: string; body: string }>(sql`select subject, body from reminder_templates where workspace_id = ${wsId} and template_key = ${k} and language = ${lang}`);
  const tpl = custom ?? DEFAULT_TEMPLATES[k][lang];
  const vars = {
    client_name: d.clientName,
    invoice_number: d.invoiceNumber,
    remaining_balance: formatMoney(d.balance, d.currency),
    total: formatMoney(d.total, d.currency),
    due_date: formatDate(d.dueDate),
    days_overdue: String(d.daysOverdue),
    business_name: s.businessName,
    invoice_link: d.link,
  };
  const subject = renderTemplate(tpl.subject, vars).replace(/[\r\n]+/g, " ");
  const text = renderTemplate(tpl.body, vars);
  const html = renderEmailHtml({ body: text.replace(d.link, "").replace(/\n{3,}/g, "\n\n"), brandColor: s.brandColor, businessName: s.businessName, footer: s.invoiceFooter, link: d.link, rtl: lang === "ur" });
  return { subject, text, html };
}

export { db };
