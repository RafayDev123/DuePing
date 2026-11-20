import { db } from "@/db";
import { ApiError, notFound } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import { isYmd, todayInTz } from "@/lib/dates";
import { formatMoney, fromMinor, normalizeAmount, toMinor } from "@/lib/money";
import { one, rows, sql, likeEscape, type Exec } from "@/lib/sql";
import { cancelInvoiceSchedules, syncInvoiceSchedules } from "@/services/reminders";
import { isUniqueViolation } from "@/services/invoices";

export interface RecordInput {
  invoiceId: string;
  amount: string;
  paidAt: string;
  method: string;
  reference?: string | null;
  notes?: string | null;
  correctsPaymentId?: string;
  verificationRequestId?: string;
}

async function recordCore(tx: Exec, wsId: string, userId: string | null, input: RecordInput) {
  const inv = await one<{ id: string; client_id: string; currency: string; status: string; total: string; number: string }>(
    sql`select id, client_id, currency, status, total, number from invoices where id = ${input.invoiceId} and workspace_id = ${wsId} for update`,
    tx,
  );
  if (!inv) throw notFound("Invoice");
  if (inv.status !== "sent") {
    throw new ApiError(409, "invalid_state", inv.status === "draft" ? "Mark the invoice as sent before recording payments." : "Payments cannot be recorded on a void or cancelled invoice.");
  }
  const paid = await one<{ s: string | null }>(sql`select sum(amount) as s from payments where invoice_id = ${inv.id}`, tx);
  const balance = toMinor(inv.total, inv.currency) - toMinor(paid?.s ?? "0", inv.currency);
  const amount = toMinor(input.amount, inv.currency);
  if (amount <= BigInt(0)) throw new ApiError(422, "validation_failed", "Payment amount must be greater than zero");
  if (amount > balance) {
    throw new ApiError(
      422,
      "overpayment",
      `Amount exceeds the remaining balance of ${formatMoney(fromMinor(balance, inv.currency), inv.currency)}. Record only the outstanding amount, or reverse an earlier payment to correct it.`,
    );
  }
  const row = await one<{ id: string }>(sql`insert into payments (workspace_id, invoice_id, client_id, kind, amount, currency, paid_at, method, reference, notes, corrects_payment_id, verification_request_id, created_by)
    values (${wsId}, ${inv.id}, ${inv.client_id}, 'payment', ${fromMinor(amount, inv.currency)}, ${inv.currency}, ${input.paidAt}, ${input.method}, ${input.reference ?? null}, ${input.notes ?? null},
      ${input.correctsPaymentId ?? null}, ${input.verificationRequestId ?? null}, ${userId}) returning id`, tx);
  return { id: row!.id, invoiceId: inv.id, number: inv.number, currency: inv.currency, balanceAfter: balance - amount, amount };
}

async function afterPayment(wsId: string, userId: string | null, r: Awaited<ReturnType<typeof recordCore>>) {
  await audit(wsId, userId, "payment.recorded", "payment", r.id, { invoice: r.number, amount: fromMinor(r.amount, r.currency), currency: r.currency });
  await notify(wsId, "payment_recorded", `Payment recorded for ${r.number}`, {
    body: `${formatMoney(fromMinor(r.amount, r.currency), r.currency)} recorded. Remaining ${formatMoney(fromMinor(r.balanceAfter, r.currency), r.currency)}.`,
    link: `/app/invoices/${r.invoiceId}`,
    dedupeKey: `payment:${r.id}`,
  });
  if (r.balanceAfter <= BigInt(0)) await cancelInvoiceSchedules(wsId, r.invoiceId, "paid");
}

export async function recordPayment(wsId: string, userId: string, input: RecordInput) {
  const r = await db.transaction((tx) => recordCore(tx, wsId, userId, input));
  await afterPayment(wsId, userId, r);
  return { id: r.id, balanceAfter: fromMinor(r.balanceAfter, r.currency) };
}

async function reverseCore(tx: Exec, wsId: string, userId: string, id: string, reason: string, today: string) {
  const p = await one<{ id: string; invoice_id: string; client_id: string; kind: string; amount: string; currency: string; method: string; reference: string | null }>(
    sql`select id, invoice_id, client_id, kind, amount, currency, method, reference from payments where id = ${id} and workspace_id = ${wsId} for update`,
    tx,
  );
  if (!p) throw notFound("Payment");
  if (p.kind !== "payment") throw new ApiError(409, "invalid_state", "Only payment entries can be reversed");
  await one(sql`select id from invoices where id = ${p.invoice_id} for update`, tx);
  if (await one(sql`select 1 from payments where reverses_payment_id = ${id}`, tx)) throw new ApiError(409, "already_reversed", "This payment has already been reversed");
  const neg = fromMinor(-toMinor(p.amount, p.currency), p.currency);
  const rev = await one<{ id: string }>(sql`insert into payments (workspace_id, invoice_id, client_id, kind, amount, currency, paid_at, method, reference, reason, reverses_payment_id, created_by)
    values (${wsId}, ${p.invoice_id}, ${p.client_id}, 'reversal', ${neg}, ${p.currency}, ${today}, ${p.method}, ${p.reference}, ${reason}, ${id}, ${userId}) returning id`, tx);
  return { reversalId: rev!.id, invoiceId: p.invoice_id };
}

export async function reversePayment(wsId: string, userId: string, id: string, reason: string, tz: string) {
  try {
    const r = await db.transaction((tx) => reverseCore(tx, wsId, userId, id, reason, todayInTz(tz)));
    await audit(wsId, userId, "payment.reversed", "payment", id, { reason, reversalId: r.reversalId });
    await syncInvoiceSchedules(wsId, r.invoiceId);
    return r;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "already_reversed", "This payment has already been reversed");
    throw e;
  }
}

/** Correction = reversal of the original + a new payment, linked, in one transaction. History is never overwritten. */
export async function correctPayment(wsId: string, userId: string, id: string, input: Omit<RecordInput, "invoiceId" | "correctsPaymentId">, tz: string) {
  const out = await db.transaction(async (tx) => {
    const orig = await one<{ invoice_id: string }>(sql`select invoice_id from payments where id = ${id} and workspace_id = ${wsId}`, tx);
    if (!orig) throw notFound("Payment");
    const rev = await reverseCore(tx, wsId, userId, id, "Corrected", todayInTz(tz));
    const rec = await recordCore(tx, wsId, userId, { ...input, invoiceId: orig.invoice_id, correctsPaymentId: id });
    return { rev, rec };
  });
  await audit(wsId, userId, "payment.corrected", "payment", id, { newPaymentId: out.rec.id });
  await afterPayment(wsId, userId, out.rec);
  return { id: out.rec.id };
}

export interface LedgerRow {
  id: string; kind: string; amount: string; currency: string; paid_at: string; method: string; reference: string | null; reason: string | null;
  created_at: Date; invoice_id: string; invoice_number: string; client_id: string; client_name: string; reversed: boolean;
}

export async function listPayments(wsId: string, f: { q?: string; method?: string; currency?: string; clientId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(200, f.pageSize ?? 25);
  const where = [sql`p.workspace_id = ${wsId}`];
  if (f.method) where.push(sql`p.method = ${f.method}`);
  if (f.currency) where.push(sql`p.currency = ${f.currency}`);
  if (f.clientId) where.push(sql`p.client_id = ${f.clientId}`);
  if (f.from && isYmd(f.from)) where.push(sql`p.paid_at >= ${f.from}`);
  if (f.to && isYmd(f.to)) where.push(sql`p.paid_at <= ${f.to}`);
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    where.push(sql`(i.number ilike ${like} or c.name ilike ${like} or p.reference ilike ${like})`);
  }
  const w = sql.join(where, sql` and `);
  const total = (await one<{ n: number }>(sql`select count(*)::int as n from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = p.client_id where ${w}`))!.n;
  const list = await rows<LedgerRow>(sql`select p.id, p.kind, p.amount, p.currency, p.paid_at, p.method, p.reference, p.reason, p.created_at,
      i.id as invoice_id, i.number as invoice_number, c.id as client_id, c.name as client_name,
      exists(select 1 from payments r where r.reverses_payment_id = p.id) as reversed
    from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = p.client_id
    where ${w} order by p.paid_at desc, p.created_at desc limit ${pageSize} offset ${(page - 1) * pageSize}`);
  return { total, page, pageSize, rows: list.map((r) => ({ ...r, amount: normalizeAmount(r.amount, r.currency) })) };
}

export async function getPayment(wsId: string, id: string) {
  const p = await one<LedgerRow & { notes: string | null; reverses_payment_id: string | null; corrects_payment_id: string | null }>(sql`
    select p.id, p.kind, p.amount, p.currency, p.paid_at, p.method, p.reference, p.reason, p.notes, p.created_at, p.reverses_payment_id, p.corrects_payment_id,
      i.id as invoice_id, i.number as invoice_number, c.id as client_id, c.name as client_name,
      exists(select 1 from payments r where r.reverses_payment_id = p.id) as reversed
    from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = p.client_id where p.workspace_id = ${wsId} and p.id = ${id}`);
  if (!p) throw notFound("Payment");
  return { ...p, amount: normalizeAmount(p.amount, p.currency) };
}

export interface VerificationRow {
  id: string; invoice_id: string; invoice_number: string; client_name: string; currency: string; balance: string; reported_amount: string | null;
  reference: string | null; payer_name: string | null; message: string | null; file_id: string | null; status: string; review_note: string | null; created_at: Date;
}

export async function listVerificationRequests(wsId: string, status?: string) {
  const r = await rows<VerificationRow>(sql`select q.id, q.invoice_id, i.number as invoice_number, c.name as client_name, i.currency,
      (i.total - coalesce((select sum(amount) from payments where invoice_id = i.id), 0)) as balance,
      q.reported_amount, q.reference, q.payer_name, q.message, q.file_id, q.status, q.review_note, q.created_at
    from payment_verification_requests q join invoices i on i.id = q.invoice_id join clients c on c.id = i.client_id
    where q.workspace_id = ${wsId} ${status ? sql`and q.status = ${status}` : sql``} order by q.created_at desc limit 100`);
  return r.map((x) => ({ ...x, balance: normalizeAmount(x.balance, x.currency), reported_amount: x.reported_amount ? normalizeAmount(x.reported_amount, x.currency) : null }));
}

export async function reviewRequest(
  wsId: string,
  userId: string,
  id: string,
  action: "under_review" | "approve" | "reject",
  body: { amount?: string; method?: string; paidAt?: string; note?: string | null; reference?: string | null },
) {
  const q = await one<{ id: string; status: string; invoice_id: string; reference: string | null }>(sql`select id, status, invoice_id, reference from payment_verification_requests where id = ${id} and workspace_id = ${wsId}`);
  if (!q) throw notFound("Payment report");
  if (q.status === "approved" || q.status === "rejected") throw new ApiError(409, "invalid_state", "This report has already been reviewed");
  if (action === "under_review") {
    await rows(sql`update payment_verification_requests set status = 'under_review' where id = ${id}`);
  } else if (action === "reject") {
    await rows(sql`update payment_verification_requests set status = 'rejected', reviewed_by = ${userId}, reviewed_at = now(), review_note = ${body.note ?? null} where id = ${id}`);
  } else {
    if (!body.amount || !body.method || !body.paidAt) throw new ApiError(422, "validation_failed", "Confirm the amount you actually received, the method and date to approve.");
    const rec = await db.transaction(async (tx) => {
      const r = await recordCore(tx, wsId, userId, { invoiceId: q.invoice_id, amount: body.amount!, paidAt: body.paidAt!, method: body.method!, reference: body.reference ?? q.reference, notes: "Approved from client payment report", verificationRequestId: id });
      await rows(sql`update payment_verification_requests set status = 'approved', reviewed_by = ${userId}, reviewed_at = now(), review_note = ${body.note ?? null}, payment_id = ${r.id} where id = ${id}`, tx);
      return r;
    });
    await afterPayment(wsId, userId, rec);
  }
  await audit(wsId, userId, `payment_report.${action}`, "payment_verification_request", id);
  return { id, action };
}
