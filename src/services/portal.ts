import { ApiError } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrlFromEnv } from "@/lib/env";
import type { CheckedUpload } from "@/lib/files";
import { hit } from "@/lib/ratelimit";
import { one, rows, sql } from "@/lib/sql";
import { formatMoney, fromMinor, normalizeAmount } from "@/lib/money";
import { todayInTz } from "@/lib/dates";
import { deriveStatus } from "@/lib/status";

/** Creates a private, unguessable invoice link. Only the sha256 hash is stored — the URL is shown once. */
export async function createPortalLink(wsId: string, invoiceId: string, userId: string | null, ttlDays = 60, baseUrl?: string) {
  const inv = await one<{ status: string }>(sql`select status from invoices where id = ${invoiceId} and workspace_id = ${wsId}`);
  if (!inv) throw new ApiError(404, "not_found", "Invoice not found");
  if (inv.status !== "sent") throw new ApiError(409, "invalid_state", "Links can only be created for sent invoices. Mark the invoice as sent first.");
  const token = randomToken(32);
  const expires = new Date(Date.now() + ttlDays * 86400000);
  await rows(sql`insert into portal_access_tokens (workspace_id, invoice_id, token_hash, expires_at, created_by) values (${wsId}, ${invoiceId}, ${sha256(token)}, ${expires.toISOString()}, ${userId})`);
  await audit(wsId, userId, "portal.link_created", "invoice", invoiceId, { expires: expires.toISOString() });
  return { url: `${baseUrl ?? appUrlFromEnv()}/portal/${token}`, expiresAt: expires };
}

export async function revokePortalLinks(wsId: string, userId: string, invoiceId: string) {
  const r = await rows(sql`update portal_access_tokens set revoked_at = now() where workspace_id = ${wsId} and invoice_id = ${invoiceId} and revoked_at is null returning id`);
  await audit(wsId, userId, "portal.links_revoked", "invoice", invoiceId, { count: r.length });
  return { revoked: r.length };
}

export async function portalLinkStats(wsId: string, invoiceId: string) {
  return one<{ active: number; views: number; last_viewed: Date | null }>(sql`select
      (count(*) filter (where revoked_at is null and expires_at > now()))::int as active, coalesce(sum(view_count),0)::int as views, max(last_viewed_at) as last_viewed
    from portal_access_tokens where workspace_id = ${wsId} and invoice_id = ${invoiceId}`);
}

export interface PortalData {
  state: "ok";
  tokenId: string;
  wsId: string;
  invoiceId: string;
  business: { name: string; email: string | null; phone: string | null; address: string | null; logo: string | null; color: string; footer: string | null; paymentInstructions: string | null };
  invoice: {
    number: string; title: string | null; currency: string; issueDate: string; dueDate: string; status: string; subtotal: string; discountTotal: string; taxTotal: string; total: string;
    paid: string; balance: string; notes: string | null; paymentTerms: string | null; daysOverdue: number; pendingReport: boolean; taxRate: string; discountType: string; discountValue: string;
  };
  client: { name: string; businessName: string | null; email: string | null; address: string | null };
  items: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
  payments: { date: string; amount: string; method: string; kind: string }[];
}
export type PortalResult = PortalData | { state: "invalid" | "expired" | "revoked" | "rate_limited" };

/** Resolves a token to *public-safe* invoice data. Internal notes and ledger notes are never selected. */
export async function resolvePortal(token: string, ip: string, ua: string, event: "view" | "pdf" | "peek" = "view"): Promise<PortalResult> {
  const rl = await hit(`portal:${ip}`, 90, 60);
  if (!rl.allowed) return { state: "rate_limited" };
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return { state: "invalid" };
  const t = await one<{ id: string; workspace_id: string; invoice_id: string; expires_at: Date; revoked_at: Date | null }>(sql`select id, workspace_id, invoice_id, expires_at, revoked_at from portal_access_tokens where token_hash = ${sha256(token)}`);
  if (!t) return { state: "invalid" };
  const ipHash = sha256(`${ip}|${process.env.APP_ENCRYPTION_KEY ?? ""}`).slice(0, 24);
  if (t.revoked_at || new Date(t.expires_at) < new Date()) {
    await rows(sql`insert into portal_access_events (token_id, event, ip_hash, user_agent) values (${t.id}, 'denied', ${ipHash}, ${ua.slice(0, 200)})`);
    return { state: t.revoked_at ? "revoked" : "expired" };
  }
  const r = await one<Record<string, string | number | boolean | null>>(sql`
    select i.number, i.title, i.currency, i.issue_date, i.due_date, i.status, i.viewed_at, i.subtotal, i.discount_total, i.tax_total, i.total, i.notes, i.payment_terms, i.tax_rate, i.discount_type, i.discount_value,
      coalesce((select sum(amount) from payments where invoice_id = i.id), 0) as paid,
      (select count(*)::int from payment_verification_requests q where q.invoice_id = i.id and q.status in ('pending','under_review')) as pend,
      c.name as client_name, c.business_name as client_business, c.email as client_email, c.billing_address,
      s.business_name, s.email as b_email, s.phone as b_phone, s.address as b_address, s.logo_data_url, s.brand_color, s.invoice_footer, s.payment_instructions, s.timezone
    from invoices i join clients c on c.id = i.client_id join business_settings s on s.workspace_id = i.workspace_id where i.id = ${t.invoice_id}`);
  if (!r) return { state: "invalid" };
  const cur = r.currency as string;
  const d = deriveStatus({ stored: r.status as string, total: r.total as string, paid: r.paid as string, currency: cur, dueDate: r.due_date as string, today: todayInTz(r.timezone as string), viewedAt: r.viewed_at as string | null });
  if (event !== "peek") {
    await rows(sql`insert into portal_access_events (token_id, event, ip_hash, user_agent) values (${t.id}, ${event}, ${ipHash}, ${ua.slice(0, 200)})`);
  }
  if (event === "view") {
    await rows(sql`update portal_access_tokens set last_viewed_at = now(), view_count = view_count + 1 where id = ${t.id}`);
    await rows(sql`update invoices set viewed_at = coalesce(viewed_at, now()) where id = ${t.invoice_id}`);
  }
  const items = await rows<{ description: string; quantity: string; unit_price: string; line_total: string }>(sql`select description, quantity, unit_price, line_total from invoice_items where invoice_id = ${t.invoice_id} order by position`);
  const pays = await rows<{ paid_at: string; amount: string; method: string; kind: string }>(sql`select paid_at, amount, method, kind from payments where invoice_id = ${t.invoice_id} order by created_at`);
  const n = (v: unknown) => normalizeAmount(v as string, cur);
  return {
    state: "ok",
    tokenId: t.id,
    wsId: t.workspace_id,
    invoiceId: t.invoice_id,
    business: { name: r.business_name as string, email: r.b_email as string | null, phone: r.b_phone as string | null, address: r.b_address as string | null, logo: r.logo_data_url as string | null, color: r.brand_color as string, footer: r.invoice_footer as string | null, paymentInstructions: r.payment_instructions as string | null },
    invoice: {
      number: r.number as string, title: r.title as string | null, currency: cur, issueDate: r.issue_date as string, dueDate: r.due_date as string, status: d.status,
      subtotal: n(r.subtotal), discountTotal: n(r.discount_total), taxTotal: n(r.tax_total), total: n(r.total), paid: n(r.paid), balance: fromMinor(d.balance, cur),
      notes: r.notes as string | null, paymentTerms: r.payment_terms as string | null, daysOverdue: d.daysOverdue, pendingReport: Number(r.pend) > 0,
      taxRate: String(r.tax_rate), discountType: r.discount_type as string, discountValue: String(r.discount_value),
    },
    client: { name: r.client_name as string, businessName: r.client_business as string | null, email: r.client_email as string | null, address: r.billing_address as string | null },
    items: items.map((i) => ({ description: i.description, quantity: String(Number(i.quantity)), unitPrice: n(i.unit_price), lineTotal: n(i.line_total) })),
    payments: pays.map((p) => ({ date: p.paid_at, amount: n(p.amount), method: p.method, kind: p.kind })),
  };
}

export async function reportPayment(
  token: string,
  ip: string,
  input: { amount?: string | null; reference?: string | null; payerName?: string | null; message?: string | null },
  file: CheckedUpload | null,
) {
  const rl = await hit(`portal-report:${sha256(token).slice(0, 16)}`, 5, 3600);
  if (!rl.allowed) throw new ApiError(429, "rate_limited", "Too many payment reports for this invoice. Please contact the business directly.");
  const p = await resolvePortal(token, ip, "payment-report", "peek");
  if (p.state !== "ok") throw new ApiError(404, "not_found", "This link is not valid");
  if (p.invoice.status === "paid" || p.invoice.status === "void" || p.invoice.status === "cancelled") throw new ApiError(409, "invalid_state", "This invoice is not open for payment reports");
  if (!input.reference && !input.message && !file) throw new ApiError(422, "validation_failed", "Add a transaction reference, a note or a proof file");
  let fileId: string | null = null;
  if (file) {
    const f = await one<{ id: string }>(sql`insert into files (workspace_id, invoice_id, kind, filename, mime, size, sha256, data) values (${p.wsId}, ${p.invoiceId}, 'payment_proof', ${file.filename}, ${file.mime}, ${file.buffer.length}, ${file.sha256}, ${file.buffer}) returning id`);
    fileId = f!.id;
  }
  const req = await one<{ id: string }>(sql`insert into payment_verification_requests (workspace_id, invoice_id, reported_amount, reference, payer_name, message, file_id)
    values (${p.wsId}, ${p.invoiceId}, ${input.amount || null}, ${input.reference || null}, ${input.payerName || null}, ${input.message || null}, ${fileId}) returning id`);
  await rows(sql`insert into portal_access_events (token_id, event, ip_hash) values (${p.tokenId}, 'payment_report', ${sha256(ip).slice(0, 24)})`);
  await notify(p.wsId, "payment_reported", `${p.client.name} reported a payment for ${p.invoice.number}`, {
    body: `${input.amount ? formatMoney(input.amount, p.invoice.currency) + " reported. " : ""}Verify it against your records — it is not recorded as paid until you approve it.`,
    link: `/app/payments`,
    dedupeKey: `report:${req!.id}`,
  });
  await audit(p.wsId, null, "portal.payment_reported", "invoice", p.invoiceId, { requestId: req!.id });
  return { id: req!.id };
}
