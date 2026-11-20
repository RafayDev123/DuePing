import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, CircleDollarSign, FilePlus2, UserPlus } from "lucide-react";
import { CollectionsChart, DemoButton } from "@/components/dashboard-bits";
import { FilterBar } from "@/components/controls";
import { EmptyState, Money, PageHeader, StatusBadge } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDate, formatDateTime, todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { rows, sql } from "@/lib/sql";
import { STATUS_LABEL } from "@/lib/status";
import { clientsForSelect } from "@/services/clients";
import { dashboardOverview } from "@/services/dashboard";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Overview" };
type SP = Record<string, string | undefined>;

const RANGE_LABEL: Record<string, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", this_month: "This month", last_month: "Last month", custom: "Custom range" };

function MoneyLines({ list, empty }: { list: { currency: string; amount: string; n: number }[]; empty: string }) {
  if (!list.length) return <p className="m-0 text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="m-0 list-none space-y-0.5 p-0">
      {list.map((m) => (
        <li key={m.currency} className="flex items-baseline gap-2">
          <Money amount={m.amount} currency={m.currency} className="font-display text-[22px] font-semibold leading-tight" />
          {m.n > 0 && <span className="text-[12px] text-muted">{m.n} invoice{m.n === 1 ? "" : "s"}</span>}
        </li>
      ))}
    </ul>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const [d, clients, curRows, clientCount] = await Promise.all([
    dashboardOverview(ctx.ws.id, s.timezone, { range: sp.range, from: sp.from, to: sp.to, currency: sp.currency, clientId: sp.client, status: sp.status }),
    clientsForSelect(ctx.ws.id),
    rows<{ currency: string }>(sql`select distinct currency from invoices where workspace_id = ${ctx.ws.id} order by 1`),
    rows<{ n: number }>(sql`select count(*)::int as n from clients where workspace_id = ${ctx.ws.id}`),
  ]);
  const canWrite = can(ctx.role, "invoices.write");
  const today = todayInTz(s.timezone);

  if (d.totalInvoices === 0) {
    return (
      <>
        <PageHeader title={`Welcome to ${ctx.ws.name}`} sub="Nothing has been recorded yet — every number on this page comes from your own records." />
        <div className="card">
          <EmptyState icon={<CircleDollarSign size={20} />} title="Start with a client and an invoice" action={canWrite ? <><Link href="/app/clients?new=1" className="btn btn-primary"><UserPlus size={15} /> Add a client</Link><Link href="/app/invoices/new" className="btn"><FilePlus2 size={15} /> Create an invoice</Link></> : undefined}>
            {clientCount[0]?.n ? "You have clients but no invoices yet." : "Add the people you bill, then create your first invoice. Payments, reminders and reports build on those records."}
          </EmptyState>
          <div className="grid gap-px border-t border-line bg-[var(--line)] sm:grid-cols-3">
            {[["1. Add clients", "Name, email and WhatsApp number — so follow-ups know where to go."], ["2. Create and send invoices", "Line items, tax and discounts calculated with exact decimals."], ["3. Record payments", "Partial payments and corrections keep a full audit trail."]].map(([t, b]) => (
              <div key={t} className="bg-surface p-5"><h3 className="m-0 text-[13.5px] font-semibold">{t}</h3><p className="mt-1 text-[13px] text-muted">{b}</p></div>
            ))}
          </div>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line p-5">
              <DemoButton />
              <p className="m-0 text-[12.5px] text-muted">Want to look around first? Demo records are clearly labelled “[Demo]” and can be removed in one click.</p>
            </div>
          )}
        </div>
      </>
    );
  }

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(dt.toISOString().slice(0, 7));
  }
  const hasDemo = d.recent.some((r) => r.isDemo) || d.overdueList.some((r) => r.isDemo);
  const ctxLine = `${RANGE_LABEL[d.range.range]} (${formatDate(d.range.from)} – ${formatDate(d.range.to)}) · ${sp.currency || "All currencies"}`;
  const overdueTotal = d.overdue;

  return (
    <>
      <PageHeader title="Overview" sub={ctxLine} actions={hasDemo && canWrite ? <DemoButton remove /> : undefined} />
      <FilterBar className="mb-5" fields={[
        { name: "range", label: "Period", type: "select", options: Object.entries(RANGE_LABEL).map(([value, label]) => ({ value: value === "30d" ? "" : value, label })) },
        { name: "from", label: "From", type: "date", showWhen: { name: "range", value: "custom" } },
        { name: "to", label: "To", type: "date", showWhen: { name: "range", value: "custom" } },
        { name: "currency", label: "Currency", type: "select", options: [{ value: "", label: "All currencies" }, ...curRows.map((c) => ({ value: c.currency, label: c.currency }))] },
        { name: "client", label: "Client", type: "select", options: [{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name.slice(0, 40) }))] },
        { name: "status", label: "Invoice status", type: "select", options: [{ value: "", label: "Any status" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
      ]} />

      {/* Ledger strip — one surface, four columns, never mixes currencies */}
      <section aria-label="Balances" className="card mb-5 grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        <div className="p-5"><h2 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Outstanding</h2><MoneyLines list={d.outstanding} empty="Nothing outstanding" /></div>
        <div className="p-5 sm:border-l sm:border-line lg:border-l-0"><h2 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--danger-ink)" }}>Overdue · {d.overdueCount}</h2><MoneyLines list={overdueTotal} empty="Nothing overdue" /></div>
        <div className="p-5 sm:border-t sm:border-line lg:border-t-0"><h2 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Due in 7 days · {d.dueThisWeekCount}</h2><MoneyLines list={d.dueThisWeek} empty="Nothing due this week" /></div>
        <div className="p-5 sm:border-l sm:border-t sm:border-line lg:border-l-0 lg:border-t-0"><h2 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--success-ink)" }}>Collected in period</h2><MoneyLines list={d.paid} empty="No payments in this period" /></div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line bg-surface2 px-5 py-2.5 text-[12.5px] text-muted sm:col-span-2 lg:col-span-4">
          <span><b className="text-ink">{d.totalInvoices}</b> invoices total</span>
          <span><b className="text-ink">{d.invoicesInRange}</b> issued in period</span>
          <span><b className="text-ink">{d.partiallyPaid}</b> partially paid</span>
          <Link href="/app/reminders" className="hover:underline"><b className="text-ink">{d.reminders.upcoming}</b> upcoming reminders</Link>
          <Link href="/app/reminders?tab=failed" className="hover:underline" style={d.reminders.failed ? { color: "var(--danger-ink)" } : undefined}><b>{d.reminders.failed}</b> failed deliveries</Link>
        </div>
      </section>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card" aria-labelledby="h-coll">
          <div className="card-h"><h2 id="h-coll">Monthly collections</h2><Link href="/app/reports?type=monthly_collections" className="link text-[12.5px]">Report</Link></div>
          <CollectionsChart data={d.monthly} months={months} />
        </section>
        <section className="card" aria-labelledby="h-over">
          <div className="card-h"><h2 id="h-over" className="flex items-center gap-2"><AlertTriangle size={15} style={{ color: "var(--danger-ink)" }} /> Overdue</h2><Link href="/app/invoices?status=overdue" className="link text-[12.5px]">All {d.overdueListTotal}</Link></div>
          {d.overdueList.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No overdue invoices. 🎉 Nothing needs chasing right now.</p> : (
            <ul className="m-0 list-none divide-line p-0 divide-y">
              {d.overdueList.map((i) => (
                <li key={i.id}><Link href={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface2">
                  <span className="min-w-0"><span className="mono block text-[12.5px]">{i.number}</span><span className="block truncate text-[13.5px]">{i.clientName}</span></span>
                  <span className="text-right"><Money amount={i.balance} currency={i.currency} className="block font-semibold" /><span className="text-[12px]" style={{ color: "var(--danger-ink)" }}>{i.daysOverdue}d late</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <section className="card" aria-labelledby="h-up">
          <div className="card-h"><h2 id="h-up">Upcoming due dates</h2><span className="text-[12px] text-muted">Next 14 days</span></div>
          {d.upcoming.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No invoices fall due in the next two weeks.</p> : (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {d.upcoming.map((i) => (
                <li key={i.id}><Link href={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface2">
                  <span className="min-w-0"><span className="block truncate text-[13.5px]">{i.clientName}</span><span className="text-[12px] text-muted">{i.dueDate === today ? "Due today" : `Due ${formatDate(i.dueDate)}`}</span></span>
                  <Money amount={i.balance} currency={i.currency} className="font-semibold" />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="h-top">
          <div className="card-h"><h2 id="h-top">Top clients by balance</h2></div>
          {d.topClients.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No outstanding balances.</p> : (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {d.topClients.map((c) => (
                <li key={c.client_id + c.currency}><Link href={`/app/clients/${c.client_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface2"><span className="truncate text-[13.5px]">{c.name}</span><Money amount={c.amount} currency={c.currency} className="font-semibold" /></Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="h-pay">
          <div className="card-h"><h2 id="h-pay">Recent payment records</h2><Link href="/app/payments" className="link text-[12.5px]">Ledger</Link></div>
          {d.recentPayments.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No payments recorded yet.</p> : (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {d.recentPayments.map((p) => (
                <li key={p.id}><Link href={`/app/invoices/${p.invoice_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface2">
                  <span className="min-w-0"><span className="block truncate text-[13.5px]">{p.client}</span><span className="text-[12px] text-muted"><span className="mono">{p.number}</span> · {formatDate(p.paid_at)} · {p.method.replace(/_/g, " ")}</span></span>
                  <Money amount={p.amount} currency={p.currency} className="font-semibold" />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="card" aria-labelledby="h-rec">
          <div className="card-h"><h2 id="h-rec">Recent invoices</h2><Link href="/app/invoices" className="link inline-flex items-center gap-1 text-[12.5px]">View all <ArrowRight size={12} /></Link></div>
          {d.recent.length === 0 ? <p className="p-5 text-[13.5px] text-muted">No invoices were issued in this period.</p> : (
            <div className="scroll-x"><table className="tbl">
              <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="r">Balance</th><th>Status</th></tr></thead>
              <tbody>{d.recent.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/app/invoices/${i.id}`} className="mono link">{i.number}</Link></td>
                  <td className="max-w-[180px] truncate">{i.clientName}</td>
                  <td className="whitespace-nowrap">{formatDate(i.dueDate)}</td>
                  <td className="r"><Money amount={i.balance} currency={i.currency} /></td>
                  <td><StatusBadge status={i.status} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
        <section className="card" aria-labelledby="h-act">
          <div className="card-h"><h2 id="h-act" className="flex items-center gap-2"><Bell size={15} /> Activity</h2></div>
          {d.activity.length === 0 ? <p className="p-5 text-[13.5px] text-muted">Activity appears here as invoices are sent, paid and followed up.</p> : (
            <ol className="m-0 list-none p-5">
              {d.activity.map((a, i) => (
                <li key={i} className="relative pb-4 pl-5 last:pb-0">
                  <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full" style={{ background: a.kind.includes("failed") ? "var(--danger)" : a.kind === "payment" ? "var(--success)" : "var(--accent)" }} aria-hidden />
                  {i < d.activity.length - 1 && <span className="absolute left-[3px] top-4 h-full w-px bg-[var(--line)]" aria-hidden />}
                  <Link href={a.link} className="text-[13.5px] hover:underline"><span className="mono">{a.label}</span> — {a.detail}</Link>
                  <p className="m-0 text-[12px] text-muted">{formatDateTime(a.at, s.timezone)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="mt-6 text-[12px] text-muted">Showing live records for {ctx.ws.name}. Totals are shown per currency and are never converted or combined. Dates use {s.timezone}; today is {formatDate(today)}.</p>
    </>
  );
}
