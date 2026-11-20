import { db } from "@/db";
import { ApiError, notFound } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import { addDays, isYmd, todayInTz } from "@/lib/dates";
import { computeTotals, formatInvoiceNumber, type DiscountType } from "@/lib/invoicing";
import { fromMinor, normalizeAmount, toMinor } from "@/lib/money";
import { one, rows, sql, inList, likeEscape, type Exec } from "@/lib/sql";
import { DERIVED_STATUS_SQL, deriveStatus, type InvoiceStatus, type PaymentStatus } from "@/lib/status";
import type { InvoiceInput } from "@/lib/validation";
import { syncInvoiceSchedules, cancelInvoiceSchedules } from "@/services/reminders";
import { getSettings } from "@/services/workspace";

export interface InvoiceRow {
  id: string;
  number: string;
  title: string | null;
  currency: string;
  issueDate: string;
  dueDate: string;
  storedStatus: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus | null;
  total: string;
  paid: string;
  balance: string;
  daysOverdue: number;
  clientId: string;
  clientName: string;
  clientBusiness: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  archivedAt: Date | null;
  isDemo: boolean;
}

export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Shared FROM clause: invoices + client + ledger sum + verification request counts. */
export function invoiceBase(wsId: string) {
  return sql`from invoices i join clients c on c.id = i.client_id
    left join (select invoice_id, sum(amount) as paid from payments where workspace_id = ${wsId} group by invoice_id) p on p.invoice_id = i.id
    left join (select invoice_id,
        (count(*) filter (where status = 'pending'))::int as pend,
        (count(*) filter (where status = 'under_review'))::int as rev
      from payment_verification_requests where workspace_id = ${wsId} group by invoice_id) v on v.invoice_id = i.id`;
}

export const INVOICE_COLUMNS = sql`i.id, i.number, i.title, i.currency, i.issue_date, i.due_date, i.status as stored_status, i.total,
  coalesce(p.paid, 0) as paid, i.client_id, c.name as client_name, c.business_name as client_business, i.sent_at, i.viewed_at, i.archived_at,
  i.is_demo, coalesce(v.pend, 0) as pend, coalesce(v.rev, 0) as rev`;

type RawInvoiceRow = {
  id: string; number: string; title: string | null; currency: string; issue_date: string; due_date: string; stored_status: string;
  total: string; paid: string; client_id: string; client_name: string; client_business: string | null; sent_at: Date | null;
  viewed_at: Date | null; archived_at: Date | null; is_demo: boolean; pend: number; rev: number;
};

export function mapInvoiceRow(r: RawInvoiceRow, today: string): InvoiceRow {
  const d = deriveStatus({
    stored: r.stored_status, total: r.total, paid: r.paid, currency: r.currency, dueDate: r.due_date, today,
    viewedAt: r.viewed_at, pendingRequests: r.pend, reviewRequests: r.rev,
  });
  return {
    id: r.id, number: r.number, title: r.title, currency: r.currency, issueDate: r.issue_date, dueDate: r.due_date,
    storedStatus: r.stored_status, status: d.status, paymentStatus: d.paymentStatus,
    total: normalizeAmount(r.total, r.currency), paid: normalizeAmount(r.paid, r.currency), balance: fromMinor(d.balance, r.currency),
    daysOverdue: d.daysOverdue, clientId: r.client_id, clientName: r.client_name, clientBusiness: r.client_business,
    sentAt: r.sent_at, viewedAt: r.viewed_at, archivedAt: r.archived_at, isDemo: r.is_demo,
  };
}

export function derivedSql(today: string) {
  if (!isYmd(today)) throw new Error("invalid date");
  return sql.raw(DERIVED_STATUS_SQL(today));
}

export interface InvoiceFilters {
  q?: string; status?: string; clientId?: string; currency?: string; from?: string; to?: string;
  sort?: string; dir?: string; page?: number; pageSize?: number; archived?: boolean; ids?: string[]; dueFrom?: string; dueTo?: string;
}

const SORTS: Record<string, string> = {
  number: "i.number", client: "c.name", issue: "i.issue_date", due: "i.due_date", total: "i.total",
  paid: "coalesce(p.paid,0)", balance: "(i.total - coalesce(p.paid,0))", created: "i.created_at",
};

export function buildInvoiceWhere(wsId: string, today: string, f: InvoiceFilters) {
  const where = [sql`i.workspace_id = ${wsId}`];
  where.push(f.archived ? sql`i.archived_at is not null` : sql`i.archived_at is null`);
  if (f.ids) where.push(sql`i.id in (${inList(f.ids)})`);
  if (f.status) where.push(sql`${derivedSql(today)} = ${f.status}`);
  if (f.clientId) where.push(sql`i.client_id = ${f.clientId}`);
  if (f.currency) where.push(sql`i.currency = ${f.currency}`);
  if (f.from && isYmd(f.from)) where.push(sql`i.issue_date >= ${f.from}`);
  if (f.to && isYmd(f.to)) where.push(sql`i.issue_date <= ${f.to}`);
  if (f.dueFrom && isYmd(f.dueFrom)) where.push(sql`i.due_date >= ${f.dueFrom}`);
  if (f.dueTo && isYmd(f.dueTo)) where.push(sql`i.due_date <= ${f.dueTo}`);
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    where.push(sql`(i.number ilike ${like} or i.title ilike ${like} or c.name ilike ${like} or c.business_name ilike ${like})`);
  }
  return sql.join(where, sql` and `);
}

export async function listInvoices(wsId: string, tz: string, f: InvoiceFilters) {
  const today = todayInTz(tz);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(5000, Math.max(1, f.pageSize ?? 15));
  const w = buildInvoiceWhere(wsId, today, f);
  const sortCol = SORTS[f.sort ?? "created"] ?? SORTS.created;
  const dir = f.dir === "asc" ? "asc" : "desc";
  const total = (await one<{ n: number }>(sql`select count(*)::int as n ${invoiceBase(wsId)} where ${w}`))!.n;
  const raw = await rows<RawInvoiceRow>(sql`select ${INVOICE_COLUMNS} ${invoiceBase(wsId)} where ${w}
    order by ${sql.raw(sortCol)} ${sql.raw(dir)}, i.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`);
  return { total, page, pageSize, rows: raw.map((r) => mapInvoiceRow(r, today)) };
}

export interface InvoiceDetail {
  invoice: InvoiceRow & {
    discountType: string; discountValue: string; taxRate: string; subtotal: string; discountTotal: string; taxTotal: string;
    paymentTerms: string | null; notes: string | null; internalNotes: string | null; voidReason: string | null; recurringId: string | null;
  };
  client: { id: string; name: string; business_name: string | null; email: string | null; phone: string | null; country: string | null; billing_address: string | null; tax_id: string | null; language: string; preferred_channel: string; reminders_paused: boolean; whatsapp_consent_at: Date | null };
  items: { id: string; description: string; quantity: string; unit_price: string; line_total: string }[];
  payments: PaymentRow[];
  requests: RequestRow[];
  files: { id: string; filename: string; mime: string; size: number; created_at: Date }[];
}

export interface PaymentRow {
  id: string; kind: string; amount: string; currency: string; paid_at: string; method: string; reference: string | null; notes: string | null;
  reason: string | null; reverses_payment_id: string | null; corrects_payment_id: string | null; created_at: Date; reversed: boolean; created_by_name: string | null;
}
export interface RequestRow {
  id: string; reported_amount: string | null; reference: string | null; payer_name: string | null; message: string | null; file_id: string | null;
  status: string; review_note: string | null; created_at: Date; reviewed_at: Date | null;
}

export async function getInvoice(wsId: string, id: string, tz: string, exec: Exec = db): Promise<InvoiceDetail> {
  const today = todayInTz(tz);
  const r = await one<RawInvoiceRow & Record<string, string | null>>(
    sql`select ${INVOICE_COLUMNS}, i.discount_type, i.discount_value, i.tax_rate, i.subtotal, i.discount_total, i.tax_total, i.payment_terms,
      i.notes, i.internal_notes, i.void_reason, i.recurring_id ${invoiceBase(wsId)} where i.workspace_id = ${wsId} and i.id = ${id}`,
    exec,
  );
  if (!r) throw notFound("Invoice");
  const base = mapInvoiceRow(r as unknown as RawInvoiceRow, today);
  const cur = base.currency;
  const [client, items, payments, requests, files] = await Promise.all([
    one<InvoiceDetail["client"]>(sql`select id, name, business_name, email, phone, country, billing_address, tax_id, language, preferred_channel, reminders_paused, whatsapp_consent_at from clients where id = ${base.clientId}`, exec),
    rows<InvoiceDetail["items"][number]>(sql`select id, description, quantity, unit_price, line_total from invoice_items where invoice_id = ${id} order by position asc`, exec),
    rows<PaymentRow>(sql`select p.id, p.kind, p.amount, p.currency, p.paid_at, p.method, p.reference, p.notes, p.reason, p.reverses_payment_id, p.corrects_payment_id, p.created_at,
        exists(select 1 from payments r where r.reverses_payment_id = p.id) as reversed, u.name as created_by_name
      from payments p left join users u on u.id = p.created_by where p.invoice_id = ${id} and p.workspace_id = ${wsId} order by p.created_at asc`, exec),
    rows<RequestRow>(sql`select id, reported_amount, reference, payer_name, message, file_id, status, review_note, created_at, reviewed_at from payment_verification_requests where invoice_id = ${id} and workspace_id = ${wsId} order by created_at desc`, exec),
    rows<InvoiceDetail["files"][number]>(sql`select id, filename, mime, size, created_at from files where invoice_id = ${id} and workspace_id = ${wsId} and kind = 'invoice_attachment' order by created_at desc`, exec),
  ]);
  return {
    invoice: {
      ...base,
      discountType: r.discount_type as string, discountValue: r.discount_value as string, taxRate: r.tax_rate as string,
      subtotal: normalizeAmount(r.subtotal, cur), discountTotal: normalizeAmount(r.discount_total, cur), taxTotal: normalizeAmount(r.tax_total, cur),
      paymentTerms: r.payment_terms, notes: r.notes, internalNotes: r.internal_notes, voidReason: r.void_reason, recurringId: r.recurring_id,
    },
    client: client!,
    items: items.map((it) => ({ ...it, unit_price: normalizeAmount(it.unit_price, cur), line_total: normalizeAmount(it.line_total, cur), quantity: String(Number(it.quantity)) })),
    payments: payments.map((p) => ({ ...p, amount: normalizeAmount(p.amount, p.currency) })),
    requests: requests.map((q) => ({ ...q, reported_amount: q.reported_amount ? normalizeAmount(q.reported_amount, cur) : null })),
    files,
  };
}

async function nextNumber(tx: Exec, wsId: string, format: string, issueYear: number): Promise<string> {
  const seqYear = /\{YY(YY)?\}/.test(format) ? issueYear : 0;
  for (let i = 0; i < 60; i++) {
    const r = await one<{ last_number: number }>(sql`insert into invoice_sequences (workspace_id, year, last_number) values (${wsId}, ${seqYear}, 1)
      on conflict (workspace_id, year) do update set last_number = invoice_sequences.last_number + 1 returning last_number`, tx);
    const num = formatInvoiceNumber(format, issueYear, r!.last_number);
    if (!(await one(sql`select 1 from invoices where workspace_id = ${wsId} and number = ${num}`, tx))) return num;
  }
  throw new ApiError(500, "number_generation_failed", "Could not generate a unique invoice number");
}

async function assertClient(tx: Exec, wsId: string, clientId: string) {
  const c = await one<{ archived_at: Date | null }>(sql`select archived_at from clients where id = ${clientId} and workspace_id = ${wsId}`, tx);
  if (!c) throw new ApiError(422, "validation_failed", "Client not found in this workspace");
  if (c.archived_at) throw new ApiError(422, "validation_failed", "This client is archived");
}

async function insertItems(tx: Exec, invoiceId: string, input: InvoiceInput, lines: string[]) {
  for (let idx = 0; idx < input.items.length; idx++) {
    const it = input.items[idx];
    await rows(sql`insert into invoice_items (invoice_id, position, description, quantity, unit_price, line_total)
      values (${invoiceId}, ${idx}, ${it.description}, ${it.quantity}, ${it.unitPrice}, ${lines[idx]})`, tx);
  }
}

export async function createInvoice(wsId: string, userId: string | null, input: InvoiceInput, extra: { isDemo?: boolean; recurringId?: string } = {}) {
  const settings = await getSettings(wsId);
  const totals = computeTotals(input);
  if (toMinor(totals.total, input.currency) <= BigInt(0)) throw new ApiError(422, "validation_failed", "Invoice total must be greater than zero");
  try {
    const out = await db.transaction(async (tx) => {
      await assertClient(tx, wsId, input.clientId);
      let number = input.number;
      if (number) {
        if (await one(sql`select 1 from invoices where workspace_id = ${wsId} and number = ${number}`, tx)) {
          throw new ApiError(409, "duplicate_number", `Invoice number ${number} already exists in this workspace`);
        }
      } else {
        number = await nextNumber(tx, wsId, settings.numberFormat, Number(input.issueDate.slice(0, 4)));
      }
      const inv = await one<{ id: string }>(sql`insert into invoices
        (workspace_id, client_id, number, title, currency, issue_date, due_date, status, sent_at, discount_type, discount_value, tax_rate,
         subtotal, discount_total, tax_total, total, payment_terms, notes, internal_notes, is_demo, recurring_id, created_by)
        values (${wsId}, ${input.clientId}, ${number}, ${input.title}, ${input.currency}, ${input.issueDate}, ${input.dueDate}, ${input.status},
         ${input.status === "sent" ? sql`now()` : sql`null`}, ${input.discountType}, ${input.discountValue}, ${input.taxRate},
         ${totals.subtotal}, ${totals.discountTotal}, ${totals.taxTotal}, ${totals.total}, ${input.paymentTerms}, ${input.notes}, ${input.internalNotes},
         ${extra.isDemo ?? false}, ${extra.recurringId ?? null}, ${userId}) returning id`, tx);
      await insertItems(tx, inv!.id, input, totals.lines);
      return { id: inv!.id, number };
    });
    await audit(wsId, userId, "invoice.created", "invoice", out.id, { number: out.number, status: input.status });
    if (input.status === "sent") await syncInvoiceSchedules(wsId, out.id);
    return out;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "duplicate_number", "That invoice number already exists in this workspace");
    throw e;
  }
}

export async function updateDraft(wsId: string, userId: string, id: string, input: InvoiceInput) {
  const totals = computeTotals(input);
  if (toMinor(totals.total, input.currency) <= BigInt(0)) throw new ApiError(422, "validation_failed", "Invoice total must be greater than zero");
  try {
    await db.transaction(async (tx) => {
      const cur = await one<{ status: string; number: string }>(sql`select status, number from invoices where id = ${id} and workspace_id = ${wsId} for update`, tx);
      if (!cur) throw notFound("Invoice");
      if (cur.status !== "draft") throw new ApiError(409, "not_editable", "Only draft invoices can be edited. Void or duplicate this invoice instead.");
      await assertClient(tx, wsId, input.clientId);
      if (input.number && input.number !== cur.number && (await one(sql`select 1 from invoices where workspace_id = ${wsId} and number = ${input.number} and id <> ${id}`, tx))) {
        throw new ApiError(409, "duplicate_number", `Invoice number ${input.number} already exists in this workspace`);
      }
      await rows(sql`update invoices set client_id = ${input.clientId}, number = ${input.number ?? cur.number}, title = ${input.title}, currency = ${input.currency},
        issue_date = ${input.issueDate}, due_date = ${input.dueDate}, discount_type = ${input.discountType}, discount_value = ${input.discountValue},
        tax_rate = ${input.taxRate}, subtotal = ${totals.subtotal}, discount_total = ${totals.discountTotal}, tax_total = ${totals.taxTotal}, total = ${totals.total},
        payment_terms = ${input.paymentTerms}, notes = ${input.notes}, internal_notes = ${input.internalNotes}, updated_at = now() where id = ${id}`, tx);
      await rows(sql`delete from invoice_items where invoice_id = ${id}`, tx);
      await insertItems(tx, id, input, totals.lines);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "duplicate_number", "That invoice number already exists in this workspace");
    throw e;
  }
  await audit(wsId, userId, "invoice.updated", "invoice", id);
  if (input.status === "sent") await markSent(wsId, userId, id);
  return { id };
}

export async function markSent(wsId: string, userId: string | null, id: string) {
  const r = await one<{ status: string }>(sql`update invoices set status = 'sent', sent_at = coalesce(sent_at, now()), updated_at = now()
    where id = ${id} and workspace_id = ${wsId} and status in ('draft','sent') returning status`);
  if (!r) {
    const ex = await one(sql`select 1 from invoices where id = ${id} and workspace_id = ${wsId}`);
    if (!ex) throw notFound("Invoice");
    throw new ApiError(409, "invalid_state", "Void or cancelled invoices cannot be sent");
  }
  await audit(wsId, userId, "invoice.sent", "invoice", id);
  await syncInvoiceSchedules(wsId, id);
}

/** Changing the due date of an open invoice recalculates reminders. */
export async function changeDueDate(wsId: string, userId: string, id: string, dueDate: string) {
  const r = await one<{ issue_date: string; status: string }>(sql`select issue_date, status from invoices where id = ${id} and workspace_id = ${wsId}`);
  if (!r) throw notFound("Invoice");
  if (r.status === "void" || r.status === "cancelled") throw new ApiError(409, "invalid_state", "Invoice is closed");
  if (dueDate < r.issue_date) throw new ApiError(422, "validation_failed", "Due date cannot be before the issue date");
  await rows(sql`update invoices set due_date = ${dueDate}, updated_at = now() where id = ${id}`);
  await audit(wsId, userId, "invoice.due_date_changed", "invoice", id, { dueDate });
  await syncInvoiceSchedules(wsId, id);
}

export async function closeInvoice(wsId: string, userId: string, id: string, kind: "void" | "cancelled", reason: string) {
  await db.transaction(async (tx) => {
    const inv = await one<{ status: string; currency: string }>(sql`select status, currency from invoices where id = ${id} and workspace_id = ${wsId} for update`, tx);
    if (!inv) throw notFound("Invoice");
    if (inv.status === "void" || inv.status === "cancelled") throw new ApiError(409, "invalid_state", "Invoice is already closed");
    const paid = await one<{ s: string | null }>(sql`select sum(amount) as s from payments where invoice_id = ${id}`, tx);
    if (toMinor(paid?.s ?? "0", inv.currency) > BigInt(0)) {
      throw new ApiError(409, "has_payments", "This invoice has recorded payments. Reverse them first so the ledger stays accurate.");
    }
    await rows(sql`update invoices set status = ${kind}, voided_at = now(), void_reason = ${reason}, updated_at = now() where id = ${id}`, tx);
  });
  await cancelInvoiceSchedules(wsId, id, kind === "void" ? "voided" : "cancelled");
  await rows(sql`update portal_access_tokens set revoked_at = now() where invoice_id = ${id} and revoked_at is null`);
  await audit(wsId, userId, `invoice.${kind}`, "invoice", id, { reason });
}

export async function archiveInvoice(wsId: string, userId: string, id: string, archived: boolean) {
  const r = await one(sql`update invoices set archived_at = ${archived ? sql`now()` : sql`null`} where id = ${id} and workspace_id = ${wsId} returning id`);
  if (!r) throw notFound("Invoice");
  if (archived) await cancelInvoiceSchedules(wsId, id, "archived");
  else await syncInvoiceSchedules(wsId, id);
  await audit(wsId, userId, archived ? "invoice.archived" : "invoice.restored", "invoice", id);
}

export async function duplicateInvoice(wsId: string, userId: string, id: string) {
  const settings = await getSettings(wsId);
  const d = await getInvoice(wsId, id, settings.timezone);
  const today = todayInTz(settings.timezone);
  return createInvoice(wsId, userId, {
    clientId: d.client.id,
    title: d.invoice.title,
    number: null,
    currency: d.invoice.currency,
    issueDate: today,
    dueDate: addDays(today, settings.paymentTermsDays),
    items: d.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price })),
    discountType: d.invoice.discountType as DiscountType,
    discountValue: d.invoice.discountValue,
    taxRate: d.invoice.taxRate,
    paymentTerms: d.invoice.paymentTerms,
    notes: d.invoice.notes,
    internalNotes: d.invoice.internalNotes,
    status: "draft",
  });
}

export async function openInvoicesForSelect(wsId: string, tz: string) {
  const today = todayInTz(tz);
  const raw = await rows<RawInvoiceRow>(sql`select ${INVOICE_COLUMNS} ${invoiceBase(wsId)}
    where i.workspace_id = ${wsId} and i.status = 'sent' and i.archived_at is null order by i.due_date asc limit 500`);
  return raw.map((r) => mapInvoiceRow(r, today)).filter((i) => toMinor(i.balance, i.currency) > BigInt(0));
}

export { notify };
