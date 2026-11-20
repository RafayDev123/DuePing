import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachmentUpload, InvoiceActions, LedgerActions, RequestReview, ReminderRowActions } from "@/components/invoice-actions";
import { InvoicePreview } from "@/components/invoice-preview";
import { Money, PageHeader, PaymentStatusBadge, StatusBadge } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDate, formatDateTime, todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { TEMPLATE_LABEL, type TemplateKey } from "@/lib/reminder-templates";
import { isUuid } from "@/lib/sql";
import { getInvoice } from "@/services/invoices";
import { messagingHistory } from "@/services/integrations";
import { portalLinkStats } from "@/services/portal";
import { listSchedules } from "@/services/reminders";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const d = await getInvoice(ctx.ws.id, id, s.timezone).catch(() => null);
  if (!d) notFound();
  const [schedules, history, links] = await Promise.all([listSchedules(ctx.ws.id, "all", id), messagingHistory(ctx.ws.id, id), portalLinkStats(ctx.ws.id, id)]);
  const i = d.invoice;
  const today = todayInTz(s.timezone);
  const canWrite = can(ctx.role, "invoices.write");
  const canPay = can(ctx.role, "payments.write");
  const payInv = { id, number: i.number, currency: i.currency, balance: i.balance, clientName: d.client.name };
  const openReqs = d.requests.filter((r) => r.status === "pending" || r.status === "under_review");

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/app/invoices", label: "Invoices" }, { label: i.number }]}
        title={i.title || `Invoice ${i.number}`}
        sub={<span className="inline-flex flex-wrap items-center gap-2"><span className="mono">{i.number}</span><StatusBadge status={i.status} />{i.paymentStatus && i.paymentStatus !== "fully_paid" && <PaymentStatusBadge status={i.paymentStatus} />}{i.isDemo && <span className="badge b-neutral">Demo data</span>}{i.archivedAt && <span className="badge b-neutral">Archived</span>}<Link className="link" href={`/app/clients/${d.client.id}`}>{d.client.name}</Link></span>}
      />
      <div className="mb-6">
        <InvoiceActions
          invoice={{ id, number: i.number, currency: i.currency, balance: i.balance, clientName: d.client.name, storedStatus: i.storedStatus, status: i.status, dueDate: i.dueDate, archived: !!i.archivedAt, hasEmail: !!d.client.email, hasPhone: !!d.client.phone }}
          canWrite={canWrite} canPay={canPay} today={today} customMethods={s.paymentMethods}
        />
      </div>
      {i.voidReason && <p className="mb-5 rounded-md p-3 text-[13.5px]" style={{ background: "var(--neutral-soft)" }}><b>{i.status === "void" ? "Voided" : "Cancelled"}:</b> {i.voidReason}</p>}
      {openReqs.length > 0 && <p role="status" className="mb-5 rounded-md p-3 text-[13.5px]" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>The client reported a payment. It is <b>not</b> counted as paid until you verify it in <Link className="link" href="/app/payments">Payments</Link>.</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 order-2 xl:order-1">
          <InvoicePreview d={{
            business: { name: s.businessName, address: s.address, email: s.email, phone: s.phone, taxId: s.taxId, logo: s.logoDataUrl, color: s.brandColor, footer: s.invoiceFooter, paymentInstructions: s.paymentInstructions },
            client: { name: d.client.name, businessName: d.client.business_name, email: d.client.email, address: d.client.billing_address },
            number: i.number, title: i.title, status: i.status, currency: i.currency, issueDate: i.issueDate, dueDate: i.dueDate,
            items: d.items.map((x) => ({ description: x.description, quantity: x.quantity, unitPrice: x.unit_price, lineTotal: x.line_total })),
            subtotal: i.subtotal, discountTotal: i.discountTotal, discountLabel: i.discountType === "percent" ? `Discount (${Number(i.discountValue)}%)` : "Discount", taxTotal: i.taxTotal, taxRate: i.taxRate, total: i.total, paid: i.paid, balance: i.balance,
            paymentTerms: i.paymentTerms, notes: i.notes, payments: d.payments.map((p) => ({ date: p.paid_at, method: p.method, amount: p.amount, kind: p.kind })),
          }} />
          {i.internalNotes && <div className="card mt-5 p-4"><h2 className="m-0 mb-1 text-[13px] font-semibold">Internal notes <span className="font-normal text-muted">— never shown to the client</span></h2><p className="m-0 whitespace-pre-line text-[13.5px]">{i.internalNotes}</p></div>}
        </div>

        <aside className="order-1 space-y-5 xl:order-2">
          <section className="card" aria-labelledby="h-bal">
            <div className="card-h"><h2 id="h-bal">Balance</h2></div>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-2 p-5 text-[13.5px]">
              <dt className="text-muted">Invoice total</dt><dd className="m-0 text-right"><Money amount={i.total} currency={i.currency} /></dd>
              <dt className="text-muted">Paid (net of reversals)</dt><dd className="m-0 text-right"><Money amount={i.paid} currency={i.currency} /></dd>
              <dt className="border-t border-line pt-2 font-semibold">Remaining</dt><dd className="m-0 border-t border-line pt-2 text-right font-display text-[20px] font-semibold"><Money amount={i.balance} currency={i.currency} /></dd>
              <dt className="text-muted">Due</dt><dd className="m-0 text-right" style={i.status === "overdue" ? { color: "var(--danger-ink)", fontWeight: 600 } : undefined}>{formatDate(i.dueDate)}{i.daysOverdue > 0 && ` · ${i.daysOverdue}d late`}</dd>
            </dl>
          </section>

          <section className="card" aria-labelledby="h-led">
            <div className="card-h"><h2 id="h-led">Payment ledger</h2></div>
            {d.payments.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No payments recorded.</p> : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3 text-[13.5px]" style={p.reversed ? { opacity: 0.6 } : undefined}>
                    <div className="min-w-0">
                      <p className="m-0"><span className="num font-semibold" style={p.kind === "reversal" ? { color: "var(--danger-ink)" } : undefined}>{p.kind === "reversal" ? "−" : ""}<Money amount={p.kind === "reversal" ? p.amount.replace("-", "") : p.amount} currency={p.currency} /></span> <span className="text-muted">· {p.kind === "reversal" ? "Reversal" : p.method.replace(/_/g, " ")}</span></p>
                      <p className="m-0 text-[12px] text-muted">{formatDate(p.paid_at)}{p.reference && <> · <span className="mono">{p.reference}</span></>}{p.reversed && " · reversed"}{p.corrects_payment_id && " · correction"}{p.reason && ` · ${p.reason}`}</p>
                      {p.created_by_name && <p className="m-0 text-[11.5px] text-muted">by {p.created_by_name}</p>}
                    </div>
                    {canPay && p.kind === "payment" && !p.reversed && i.storedStatus === "sent" && <LedgerActions payment={{ id: p.id, amount: p.amount, method: p.method, reference: p.reference, paidAt: p.paid_at }} invoice={payInv} today={today} customMethods={s.paymentMethods} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {d.requests.length > 0 && (
            <section className="card" aria-labelledby="h-req">
              <div className="card-h"><h2 id="h-req">Client payment reports</h2></div>
              <ul className="m-0 list-none divide-y divide-line p-0">
                {d.requests.map((r) => (
                  <li key={r.id} className="space-y-2 px-5 py-3 text-[13.5px]">
                    <p className="m-0 flex items-center justify-between gap-2"><span>{r.reported_amount ? <Money amount={r.reported_amount} currency={i.currency} /> : "Amount not stated"}</span><span className={`badge ${r.status === "approved" ? "b-success" : r.status === "rejected" ? "b-danger" : r.status === "under_review" ? "b-info" : "b-accent"}`}>{r.status === "pending" ? "Pending verification" : r.status.replace("_", " ")}</span></p>
                    <p className="m-0 text-[12px] text-muted">{formatDateTime(r.created_at, s.timezone)}{r.reference && <> · <span className="mono">{r.reference}</span></>}</p>
                    {r.message && <p className="m-0 text-[13px]">“{r.message}”</p>}
                    {r.file_id && <a className="link text-[12.5px]" href={`/api/v1/files/${r.file_id}`}>Download proof (unverified)</a>}
                    {canPay && (r.status === "pending" || r.status === "under_review") && <RequestReview req={{ id: r.id, reported_amount: r.reported_amount, reference: r.reference, balance: i.balance, currency: i.currency, status: r.status }} today={today} methods={s.paymentMethods} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card" aria-labelledby="h-rem">
            <div className="card-h"><h2 id="h-rem">Reminders</h2><Link href="/app/reminders" className="link text-[12.5px]">Manage</Link></div>
            {schedules.length === 0 ? <p className="p-5 text-[13.5px] text-muted">{s.autoRemindersEnabled ? "No reminders are scheduled for this invoice." : "Automatic reminders are off, so nothing will be sent. You can still follow up manually by email or WhatsApp."}</p> : (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {schedules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                    <div className="min-w-0"><p className="m-0">{TEMPLATE_LABEL[r.template_key as TemplateKey] ?? r.template_key}</p><p className="m-0 text-[12px] text-muted">{formatDateTime(r.scheduled_at, s.timezone)} · {r.channel} · <b>{r.status.replace("_", " ")}</b>{r.delivery_status ? ` · provider: ${r.delivery_status}` : ""}{r.cancel_reason ? ` · ${r.cancel_reason.replace(/_/g, " ")}` : ""}</p></div>
                    {canWrite && <ReminderRowActions id={r.id} status={r.status} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="h-comm">
            <div className="card-h"><h2 id="h-comm">Communication & link activity</h2></div>
            <div className="space-y-2 p-5 text-[13px]">
              <p className="m-0 text-muted">Client links: <b className="text-ink">{links?.active ?? 0}</b> active · opened <b className="text-ink">{links?.views ?? 0}</b>×{links?.last_viewed ? ` · last ${formatDateTime(links.last_viewed, s.timezone)}` : ""}</p>
              {history.emails.map((e) => <p key={e.id} className="m-0">✉ {e.kind} to {e.to_email} — <b>{e.status}</b>{e.error ? <span style={{ color: "var(--danger-ink)" }}> ({e.error})</span> : null}<span className="text-muted"> · {formatDateTime(e.created_at, s.timezone)}</span></p>)}
              {history.whatsapp.map((w) => <p key={w.id} className="m-0">💬 WhatsApp {w.mode.replace(/_/g, " ")} — <b>{w.status.replace(/_/g, " ")}</b><span className="text-muted"> · {formatDateTime(w.created_at, s.timezone)} · delivery not confirmed</span></p>)}
              {history.emails.length + history.whatsapp.length === 0 && <p className="m-0 text-muted">No messages sent from DuePing yet.</p>}
            </div>
          </section>

          <section className="card" aria-labelledby="h-att">
            <div className="card-h"><h2 id="h-att">Attachments</h2>{canWrite && <AttachmentUpload invoiceId={id} />}</div>
            {d.files.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No files attached. Attachments are private and only visible to your team.</p> : (
              <ul className="m-0 list-none divide-y divide-line p-0">{d.files.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13.5px]"><a className="link truncate" href={`/api/v1/files/${f.id}`}>{f.filename}</a><span className="text-[12px] text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span></li>)}</ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
