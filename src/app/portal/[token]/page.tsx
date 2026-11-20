import { headers } from "next/headers";
import type { Metadata } from "next";
import { Download, Mail } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";
import { PortalReport } from "@/components/portal-report";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { resolvePortal } from "@/services/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your invoice", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const p = await resolvePortal(token, ip, h.get("user-agent") || "", "view");

  if (p.state !== "ok") {
    const msg = { invalid: ["Link not found", "This invoice link is not valid. Check that you copied the whole link."], expired: ["This link has expired", "Please ask the business to send you a new link."], revoked: ["This link is no longer active", "The business has turned this link off. Please contact them for a new one."], rate_limited: ["Too many requests", "Please wait a minute and try again."] }[p.state];
    return <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 text-center"><h1 className="m-0 text-[22px] font-semibold">{msg[0]}</h1><p className="text-muted">{msg[1]}</p></main>;
  }
  const i = p.invoice;
  const closed = i.status === "void" || i.status === "cancelled";
  return (
    <div style={{ background: "var(--bg)" }} className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <p className="m-0 font-display text-[17px] font-bold" style={{ color: p.business.color }}>{p.business.name}</p>
        <div className="flex gap-2"><a className="btn btn-sm" href={`/portal/${token}/pdf`}><Download size={14} /> Download PDF</a>{p.business.email && <a className="btn btn-sm" href={`mailto:${p.business.email}?subject=${encodeURIComponent(`Invoice ${i.number}`)}`}><Mail size={14} /> Contact</a>}</div>
      </div></header>
      <main id="main" className="mx-auto max-w-[860px] space-y-5 px-3 py-6 sm:px-4">
        {closed && <p role="status" className="m-0 rounded-md p-3" style={{ background: "var(--neutral-soft)" }}>This invoice has been {i.status === "void" ? "voided" : "cancelled"} by the business. No payment is due.</p>}
        {!closed && (
          <section className="card flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Amount due">
            <div><p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-muted">{i.status === "paid" ? "Paid in full" : "Balance due"}</p><p className="m-0 font-display text-[32px] font-bold leading-tight num">{formatMoney(i.balance, i.currency)}</p>
              <p className="m-0 text-[13.5px]" style={i.status === "overdue" ? { color: "var(--danger-ink)" } : { color: "var(--muted)" }}>{i.status === "paid" ? "Thank you for your payment." : i.status === "overdue" ? `Was due ${formatDate(i.dueDate)} · ${i.daysOverdue} day(s) overdue` : `Due ${formatDate(i.dueDate)}`}</p></div>
            {i.pendingReport && <span className="badge b-accent">Your payment report is awaiting verification</span>}
          </section>
        )}
        <InvoicePreview d={{
          business: { name: p.business.name, address: p.business.address, email: p.business.email, phone: p.business.phone, logo: p.business.logo, color: p.business.color, footer: p.business.footer, paymentInstructions: p.business.paymentInstructions },
          client: { name: p.client.name, businessName: p.client.businessName, email: p.client.email, address: p.client.address },
          number: i.number, title: i.title, status: i.status, currency: i.currency, issueDate: i.issueDate, dueDate: i.dueDate,
          items: p.items.map((x) => ({ description: x.description, quantity: x.quantity, unitPrice: x.unitPrice, lineTotal: x.lineTotal })),
          subtotal: i.subtotal, discountTotal: i.discountTotal, discountLabel: i.discountType === "percent" ? `Discount (${Number(i.discountValue)}%)` : "Discount", taxTotal: i.taxTotal, taxRate: i.taxRate, total: i.total, paid: i.paid, balance: i.balance,
          paymentTerms: i.paymentTerms, notes: i.notes, payments: p.payments.map((x) => ({ date: x.date, method: x.method, amount: x.amount, kind: x.kind })),
        }} />
        {!closed && i.status !== "paid" && (
          <section className="card card-b" aria-labelledby="h-report"><h2 id="h-report" className="m-0 mb-3 text-[15px] font-semibold">Already paid?</h2><PortalReport token={token} color={p.business.color} disabled={i.pendingReport} /></section>
        )}
        <p className="text-center text-[12px] text-muted">Opening this page lets {p.business.name} see that the invoice was viewed. Private link — please don&apos;t share it. Invoicing by DuePing, which tracks payments but does not process them.</p>
      </main>
    </div>
  );
}
