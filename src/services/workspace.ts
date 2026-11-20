import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businessSettings } from "@/db/schema";
import { notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { rows, one, sql } from "@/lib/sql";
import { isValidTimezone } from "@/lib/dates";
import type { z } from "zod";
import type { settingsInput } from "@/lib/validation";
import { validateNumberFormat } from "@/lib/invoicing";
import { ApiError } from "@/lib/api";

export type Settings = typeof businessSettings.$inferSelect;

export async function getSettings(wsId: string): Promise<Settings> {
  const [s] = await db.select().from(businessSettings).where(eq(businessSettings.workspaceId, wsId));
  if (!s) throw notFound("Workspace settings");
  return s;
}

export const DEFAULT_RULES = [
  { name: "3 days before due date", offsetDays: -3, templateKey: "upcoming" },
  { name: "On the due date", offsetDays: 0, templateKey: "due_today" },
  { name: "3 days after due date", offsetDays: 3, templateKey: "first_overdue" },
  { name: "7 days overdue", offsetDays: 7, templateKey: "follow_up" },
  { name: "14 days overdue", offsetDays: 14, templateKey: "final" },
];

export async function createWorkspace(userId: string, name: string, timezone?: string | null): Promise<string> {
  const tz = timezone && isValidTimezone(timezone) ? timezone : "UTC";
  const id = await db.transaction(async (tx) => {
    const ws = await one<{ id: string }>(sql`insert into workspaces (name, owner_id) values (${name}, ${userId}) returning id`, tx);
    const wsId = ws!.id;
    await rows(sql`insert into workspace_members (workspace_id, user_id, role) values (${wsId}, ${userId}, 'owner')`, tx);
    await rows(sql`insert into business_settings (workspace_id, business_name, timezone) values (${wsId}, ${name}, ${tz})`, tx);
    await rows(sql`insert into subscriptions (workspace_id) values (${wsId})`, tx);
    for (const r of DEFAULT_RULES) {
      // Default schedule is editable; nothing is sent until automatic reminders are explicitly enabled.
      await rows(sql`insert into reminder_rules (workspace_id, name, offset_days, channel, language, template_key, enabled)
        values (${wsId}, ${r.name}, ${r.offsetDays}, 'email', 'client', ${r.templateKey}, true)`, tx);
    }
    return wsId;
  });
  await audit(id, userId, "workspace.created", "workspace", id);
  return id;
}

export async function updateSettings(wsId: string, userId: string, input: z.infer<typeof settingsInput>) {
  if (!isValidTimezone(input.timezone)) throw new ApiError(422, "validation_failed", "Unknown timezone");
  const bad = validateNumberFormat(input.numberFormat);
  if (bad) throw new ApiError(422, "validation_failed", bad);
  const logoSet = input.logoDataUrl !== undefined;
  await db
    .update(businessSettings)
    .set({
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      country: input.country,
      taxId: input.taxId,
      website: input.website,
      ...(logoSet ? { logoDataUrl: input.logoDataUrl } : {}),
      brandColor: input.brandColor,
      invoiceFooter: input.invoiceFooter,
      paymentInstructions: input.paymentInstructions,
      defaultCurrency: input.defaultCurrency,
      numberFormat: input.numberFormat,
      paymentTermsDays: input.paymentTermsDays,
      defaultTaxRate: input.defaultTaxRate,
      defaultTerms: input.defaultTerms,
      timezone: input.timezone,
      quietStart: input.quietStart,
      quietEnd: input.quietEnd,
      reminderSendHour: input.reminderSendHour,
      paymentMethods: input.paymentMethods,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.workspaceId, wsId));
  await rows(sql`update workspaces set name = ${input.businessName} where id = ${wsId}`);
  await audit(wsId, userId, "settings.updated", "workspace", wsId);
}

/** Full JSON export of workspace data (privacy / portability). Excludes secrets and file binaries. */
export async function exportWorkspace(wsId: string) {
  const q = async (t: string, extra = "") => rows(sql.raw(`select * from ${t} where workspace_id = '${wsId.replace(/[^0-9a-f-]/gi, "")}' ${extra}`));
  const [settings, clients, clientNotes, invoices, payments, requests, rules, schedules, deliveries, audits] = await Promise.all([
    q("business_settings"),
    q("clients"),
    q("client_notes"),
    q("invoices"),
    q("payments"),
    q("payment_verification_requests"),
    q("reminder_rules"),
    q("reminder_schedules"),
    q("email_deliveries"),
    q("audit_logs"),
  ]);
  const ids = invoices.map((i) => String((i as { id: string }).id));
  const items = ids.length
    ? await rows(sql.raw(`select * from invoice_items where invoice_id in (${ids.map((i) => `'${i.replace(/[^0-9a-f-]/gi, "")}'`).join(",")})`))
    : [];
  const safeSettings = settings.map((s) => ({ ...s, logo_data_url: s.logo_data_url ? "[logo omitted]" : null }));
  return { exportedAt: new Date().toISOString(), settings: safeSettings, clients, clientNotes, invoices, invoiceItems: items, payments, paymentVerificationRequests: requests, reminderRules: rules, reminderSchedules: schedules, emailDeliveries: deliveries, auditLogs: audits };
}

export async function deleteWorkspace(wsId: string, userId: string) {
  await audit(null, userId, "workspace.deleted", "workspace", wsId);
  await db.transaction(async (tx) => {
    // Ledger tables use RESTRICT FKs on invoices/clients, so remove dependents explicitly first.
    await rows(sql`delete from payment_verification_requests where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from payments where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from recurring_invoices where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from reminder_schedules where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from invoices where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from clients where workspace_id = ${wsId}`, tx);
    await rows(sql`delete from workspaces where id = ${wsId}`, tx);
  });
}
