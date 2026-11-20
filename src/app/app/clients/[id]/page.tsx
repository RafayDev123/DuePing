import Link from "next/link";
import { notFound } from "next/navigation";
import { EditClientButton, NoteForm } from "@/components/client-forms";
import { Money, PageHeader, StatusBadge } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { isUuid } from "@/lib/sql";
import { LANGUAGE_LABEL, type Language } from "@/lib/reminder-templates";
import { clientHistory, getClient, listNotes } from "@/services/clients";
import { listInvoices } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Client" };

export default async function ClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireContext();
  const c = await getClient(ctx.ws.id, id).catch(() => null);
  if (!c) notFound();
  const s = await getSettings(ctx.ws.id);
  const [inv, hist, notes] = await Promise.all([listInvoices(ctx.ws.id, s.timezone, { clientId: id, pageSize: 50, sort: "issue", dir: "desc" }), clientHistory(ctx.ws.id, id), listNotes(ctx.ws.id, id)]);
  const canWrite = can(ctx.role, "clients.write");
  return (
    <>
      <PageHeader crumbs={[{ href: "/app/clients", label: "Clients" }, { label: c.name }]} title={c.name}
        sub={<span>{c.businessName ?? "Individual"}{c.archivedAt && <span className="badge b-neutral ml-2">Archived</span>}{c.isDemo && <span className="badge b-neutral ml-2">Demo</span>}</span>}
        actions={<>{canWrite && !c.archivedAt && <Link href={`/app/invoices/new?client=${id}`} className="btn btn-primary btn-sm">New invoice</Link>}{canWrite && <EditClientButton id={id} archived={!!c.archivedAt} initial={{ name: c.name, businessName: c.businessName ?? "", email: c.email ?? "", phone: c.phone ?? "", country: c.country ?? "", billingAddress: c.billingAddress ?? "", taxId: c.taxId ?? "", language: c.language, preferredChannel: c.preferredChannel, whatsappConsent: !!c.whatsappConsentAt, remindersPaused: c.remindersPaused }} />}</>} />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <section className="card"><div className="card-h"><h2>Outstanding balance</h2></div>
            <div className="card-b">{hist.outstanding.length === 0 ? <p className="m-0 text-muted">Nothing outstanding.</p> : hist.outstanding.map((o) => <p key={o.currency} className="m-0"><Money amount={o.amount} currency={o.currency} className="font-display text-[22px] font-semibold" /></p>)}
              {hist.outstanding.length > 1 && <p className="hint">Shown per currency — never combined.</p>}</div></section>
          <section className="card"><div className="card-h"><h2>Details</h2></div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-[13.5px]">
              <dt className="text-muted">Email</dt><dd className="m-0 break-all">{c.email ?? "—"}</dd>
              <dt className="text-muted">Phone</dt><dd className="m-0">{c.phone ?? "—"}</dd>
              <dt className="text-muted">Country</dt><dd className="m-0">{c.country ?? "—"}</dd>
              <dt className="text-muted">Tax ID</dt><dd className="m-0">{c.taxId ?? "—"}</dd>
              <dt className="text-muted">Address</dt><dd className="m-0 whitespace-pre-line">{c.billingAddress ?? "—"}</dd>
              <dt className="text-muted">Language</dt><dd className="m-0">{LANGUAGE_LABEL[c.language as Language] ?? c.language}</dd>
              <dt className="text-muted">Channel</dt><dd className="m-0">{c.preferredChannel}{c.preferredChannel === "whatsapp" && !c.whatsappConsentAt && <span className="block text-[12px]" style={{ color: "var(--warning-ink)" }}>No WhatsApp consent recorded — manual click-to-chat only.</span>}</dd>
              <dt className="text-muted">Reminders</dt><dd className="m-0">{c.remindersPaused ? <span className="badge b-warning">Paused</span> : "Active"}</dd>
              <dt className="text-muted">Added</dt><dd className="m-0">{formatDate(c.createdAt)}</dd>
            </dl></section>
          <section className="card"><div className="card-h"><h2>Internal notes</h2></div>
            {canWrite && <NoteForm clientId={id} />}
            <ul className="m-0 list-none divide-y divide-line border-t border-line p-0">
              {notes.length === 0 && <li className="p-5 text-[13.5px] text-muted">No notes yet. Notes are never visible to the client.</li>}
              {notes.map((n) => <li key={n.id} className="px-5 py-3"><p className="m-0 whitespace-pre-line text-[13.5px]">{n.body}</p><p className="m-0 text-[12px] text-muted">{n.author ?? "Team"} · {formatDateTime(n.created_at, s.timezone)}</p></li>)}
            </ul></section>
        </div>
        <div className="min-w-0 space-y-5">
          <section className="card"><div className="card-h"><h2>Invoices ({inv.total})</h2></div>
            {inv.rows.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No invoices for this client yet.</p> : (
              <div className="scroll-x"><table className="tbl"><thead><tr><th>Invoice</th><th>Due</th><th className="r">Total</th><th className="r">Balance</th><th>Status</th></tr></thead>
                <tbody>{inv.rows.map((i) => <tr key={i.id}><td><Link className="mono link" href={`/app/invoices/${i.id}`}>{i.number}</Link></td><td className="whitespace-nowrap">{formatDate(i.dueDate)}</td><td className="r"><Money amount={i.total} currency={i.currency} /></td><td className="r"><Money amount={i.balance} currency={i.currency} /></td><td><StatusBadge status={i.status} /></td></tr>)}</tbody></table></div>
            )}</section>
          <section className="card"><div className="card-h"><h2>Payment history</h2></div>
            {hist.payments.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No payments recorded for this client.</p> : (
              <div className="scroll-x"><table className="tbl"><thead><tr><th>Date</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="r">Amount</th></tr></thead>
                <tbody>{hist.payments.map((p) => <tr key={p.id}><td className="whitespace-nowrap">{formatDate(p.paid_at)}</td><td><Link className="mono link" href={`/app/invoices/${p.invoice_id}`}>{p.invoice_number}</Link></td><td>{p.kind === "reversal" ? "Reversal" : p.method.replace(/_/g, " ")}</td><td className="mono">{p.reference ?? "—"}</td><td className="r"><Money amount={p.amount} currency={p.currency} /></td></tr>)}</tbody></table></div>
            )}</section>
        </div>
      </div>
    </>
  );
}
