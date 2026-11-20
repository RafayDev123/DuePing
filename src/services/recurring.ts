import { ApiError, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, rows, sql } from "@/lib/sql";
import { getInvoice } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export async function listRecurring(wsId: string) {
  return rows<{ id: string; title: string | null; client_name: string; currency: string; frequency: string; interval_days: number | null; next_run_date: string; end_date: string | null; active: boolean; last_run_at: Date | null; items: { quantity: string; unitPrice: string }[] }>(sql`
    select r.id, r.title, c.name as client_name, r.currency, r.frequency, r.interval_days, r.next_run_date, r.end_date, r.active, r.last_run_at, r.items
    from recurring_invoices r join clients c on c.id = r.client_id where r.workspace_id = ${wsId} order by r.created_at desc`);
}

export async function createRecurring(
  wsId: string, userId: string,
  input: { fromInvoiceId: string; frequency: string; intervalDays?: number | null; nextRunDate: string; endDate?: string | null },
) {
  const s = await getSettings(wsId);
  const d = await getInvoice(wsId, input.fromInvoiceId, s.timezone);
  if (input.frequency === "custom" && !input.intervalDays) throw new ApiError(422, "validation_failed", "Custom schedules need an interval in days");
  const row = await one<{ id: string }>(sql`insert into recurring_invoices
    (workspace_id, client_id, title, currency, items, discount_type, discount_value, tax_rate, payment_terms_days, notes, frequency, interval_days, next_run_date, end_date, created_by)
    values (${wsId}, ${d.client.id}, ${d.invoice.title}, ${d.invoice.currency},
      ${JSON.stringify(d.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price })))}::jsonb,
      ${d.invoice.discountType}, ${d.invoice.discountValue}, ${d.invoice.taxRate}, ${s.paymentTermsDays}, ${d.invoice.notes},
      ${input.frequency}, ${input.frequency === "custom" ? input.intervalDays! : null}, ${input.nextRunDate}, ${input.endDate ?? null}, ${userId}) returning id`);
  await audit(wsId, userId, "recurring.created", "recurring", row!.id);
  return row!;
}

export async function setRecurringActive(wsId: string, userId: string, id: string, active: boolean) {
  const r = await one(sql`update recurring_invoices set active = ${active} where id = ${id} and workspace_id = ${wsId} returning id`);
  if (!r) throw notFound("Recurring schedule");
  await audit(wsId, userId, active ? "recurring.resumed" : "recurring.paused", "recurring", id);
}

export async function deleteRecurring(wsId: string, userId: string, id: string) {
  const r = await one(sql`delete from recurring_invoices where id = ${id} and workspace_id = ${wsId} returning id`);
  if (!r) throw notFound("Recurring schedule");
  await audit(wsId, userId, "recurring.deleted", "recurring", id);
}
