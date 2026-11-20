import Link from "next/link";
import { Wallet } from "lucide-react";
import { FilterBar } from "@/components/controls";
import { RequestReview } from "@/components/invoice-actions";
import { RecordPaymentButton } from "@/components/record-payment-button";
import { EmptyState, Money, PageHeader, Pagination, SearchParamsToQuery } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDate, formatDateTime, todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { rows, sql } from "@/lib/sql";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation";
import { clientsForSelect } from "@/services/clients";
import { openInvoicesForSelect } from "@/services/invoices";
import { listPayments, listVerificationRequests } from "@/services/payments";
import { runReport } from "@/services/reports";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const today = todayInTz(s.timezone);
  const canPay = can(ctx.role, "payments.write");
  const [res, reqs, open, clients, cur, balances] = await Promise.all([
    listPayments(ctx.ws.id, { q: sp.q, method: sp.method, currency: sp.currency, clientId: sp.client, from: sp.from, to: sp.to, page: Math.max(1, Number(sp.page) || 1), pageSize: 20 }),
    listVerificationRequests(ctx.ws.id),
    openInvoicesForSelect(ctx.ws.id, s.timezone),
    clientsForSelect(ctx.ws.id),
    rows<{ currency: string }>(sql`select distinct currency from invoices where workspace_id = ${ctx.ws.id} order by 1`),
    runReport(ctx.ws.id, s.timezone, "client_balances", {}),
  ]);
  const pending = reqs.filter((r) => r.status === "pending" || r.status === "under_review");
  const owing = balances.rows.filter((r) => Number(r.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 8);
  const filtered = !!(sp.q || sp.method || sp.currency || sp.client || sp.from || sp.to);

  return (
    <>
      <PageHeader title="Payments" sub="An append-only ledger. Corrections and reversals add entries — nothing is overwritten or silently deleted."
        actions={canPay ? <RecordPaymentButton invoices={open.map((i) => ({ id: i.id, number: i.number, currency: i.currency, balance: i.balance, clientName: i.clientName }))} today={today} customMethods={s.paymentMethods} /> : undefined} />

      {pending.length > 0 && (
        <section className="card mb-5" style={{ borderColor: "var(--accent)" }} aria-labelledby="h-ver">
          <div className="card-h"><h2 id="h-ver">Payment reports to verify ({pending.length})</h2><span className="text-[12px] text-muted">Clients said they paid — confirm in your bank or provider first</span></div>
          <ul className="m-0 list-none divide-y divide-line p-0">
            {pending.map((r) => (
              <li key={r.id} className="space-y-2 px-5 py-4 text-[13.5px]">
                <p className="m-0 flex flex-wrap items-center justify-between gap-2"><span><Link className="mono link" href={`/app/invoices/${r.invoice_id}`}>{r.invoice_number}</Link> · {r.client_name}{r.payer_name && ` (paid by ${r.payer_name})`}</span><span className={`badge ${r.status === "under_review" ? "b-info" : "b-accent"}`}>{r.status === "pending" ? "Pending verification" : "Under review"}</span></p>
                <p className="m-0 text-muted">{r.reported_amount ? <>Reported <Money amount={r.reported_amount} currency={r.currency} /> · </> : "No amount stated · "}remaining <Money amount={r.balance} currency={r.currency} />{r.reference && <> · ref <span className="mono">{r.reference}</span></>} · {formatDateTime(r.created_at, s.timezone)}</p>
                {r.message && <p className="m-0">“{r.message}”</p>}
                {r.file_id && <a className="link text-[12.5px]" href={`/api/v1/files/${r.file_id}`}>Download uploaded proof (not verified)</a>}
                {canPay && <RequestReview req={{ id: r.id, reported_amount: r.reported_amount, reference: r.reference, balance: r.balance, currency: r.currency, status: r.status }} today={today} methods={s.paymentMethods} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <FilterBar className="mb-4" fields={[
            { name: "q", label: "Search", type: "search", placeholder: "Invoice, client or reference" },
            { name: "method", label: "Method", type: "select", options: [{ value: "", label: "All methods" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] })), ...s.paymentMethods.map((m) => ({ value: m, label: m }))] },
            { name: "currency", label: "Currency", type: "select", options: [{ value: "", label: "All" }, ...cur.map((c) => ({ value: c.currency, label: c.currency }))] },
            { name: "client", label: "Client", type: "select", options: [{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name.slice(0, 36) }))] },
            { name: "from", label: "From", type: "date" }, { name: "to", label: "To", type: "date" },
          ]} />
          <div className="card overflow-hidden">
            {res.rows.length === 0 ? <EmptyState icon={<Wallet size={20} />} title={filtered ? "No payments match" : "No payments recorded yet"}>{filtered ? "Adjust the filters." : "Record a payment from an invoice to start the ledger. Partial payments are supported."}</EmptyState> : (
              <>
                <div className="scroll-x"><table className="tbl">
                  <thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Method</th><th>Reference</th><th className="r">Amount</th></tr></thead>
                  <tbody>{res.rows.map((p) => (
                    <tr key={p.id} style={p.reversed ? { opacity: 0.55 } : undefined}>
                      <td className="whitespace-nowrap">{formatDate(p.paid_at)}</td>
                      <td><Link href={`/app/invoices/${p.invoice_id}`} className="mono link">{p.invoice_number}</Link></td>
                      <td className="max-w-[180px] truncate">{p.client_name}</td>
                      <td>{p.kind === "reversal" ? <span className="badge b-danger">Reversal</span> : p.method.replace(/_/g, " ")}{p.reversed && <span className="badge b-neutral ml-1">Reversed</span>}</td>
                      <td className="mono max-w-[140px] truncate" title={p.reason ?? p.reference ?? ""}>{p.kind === "reversal" ? p.reason : p.reference ?? "—"}</td>
                      <td className="r"><Money amount={p.amount} currency={p.currency} className="font-semibold" /></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                <div className="border-t border-line"><Pagination page={res.page} pageSize={res.pageSize} total={res.total} base={SearchParamsToQuery(sp)} /></div>
              </>
            )}
          </div>
        </div>
        <section className="card h-fit" aria-labelledby="h-owe">
          <div className="card-h"><h2 id="h-owe">Open balances by client</h2></div>
          {owing.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No client owes anything right now.</p> : (
            <ul className="m-0 list-none divide-y divide-line p-0">{owing.map((b, i) => <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-[13.5px]"><span className="min-w-0"><span className="block truncate">{b.client}</span><span className="text-[12px] text-muted">{b.invoices} invoice{b.invoices === 1 ? "" : "s"} · paid {String(b.paid)} of {String(b.billed)}</span></span><Money amount={String(b.balance)} currency={String(b.currency)} className="font-semibold" /></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
