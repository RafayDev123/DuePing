import Link from "next/link";
import { Download } from "lucide-react";
import { FilterBar } from "@/components/controls";
import { PrintButton } from "@/components/misc-client";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { rows, sql } from "@/lib/sql";
import { STATUS_LABEL } from "@/lib/status";
import { clientsForSelect } from "@/services/clients";
import { formatCell, REPORT_LABEL, REPORT_TYPES, runReport, type ReportType } from "@/services/reports";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const type = (REPORT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as ReportType) : "outstanding";
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const filters = { from: sp.from, to: sp.to, currency: sp.currency, clientId: sp.client, status: sp.status };
  const [r, clients, cur] = await Promise.all([
    runReport(ctx.ws.id, s.timezone, type, filters),
    clientsForSelect(ctx.ws.id),
    rows<{ currency: string }>(sql`select distinct currency from invoices where workspace_id = ${ctx.ws.id} order by 1`),
  ]);
  const qs = new URLSearchParams(Object.entries({ ...sp, type }).filter(([, v]) => v) as [string, string][]);
  const exportHref = (f: string) => `/api/v1/reports/export?${new URLSearchParams([...qs.entries(), ["format", f]]).toString()}`;
  const tabHref = (t: string) => { const q = new URLSearchParams(qs); q.set("type", t); if (t !== "outstanding" && t !== "overdue") q.delete("status"); return `/app/reports?${q.toString()}`; };
  const invoiceReport = ["outstanding", "overdue", "partial"].includes(type);

  return (
    <>
      <PageHeader title="Reports" sub={`${REPORT_LABEL[type]} · ${s.businessName}`}
        actions={<><PrintButton /><a className="btn btn-sm" href={exportHref("csv")}><Download size={14} /> CSV</a><a className="btn btn-sm" href={exportHref("xlsx")}><Download size={14} /> XLSX</a><a className="btn btn-sm" href={exportHref("pdf")}><Download size={14} /> PDF</a></>} />
      <nav aria-label="Report type" className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {REPORT_TYPES.map((t) => <Link key={t} href={tabHref(t)} aria-current={t === type ? "page" : undefined} className="whitespace-nowrap px-3.5 py-2.5 text-[13.5px] font-medium" style={{ borderBottom: `2px solid ${t === type ? "var(--accent)" : "transparent"}`, color: t === type ? "var(--ink)" : "var(--muted)" }}>{REPORT_LABEL[t]}</Link>)}
      </nav>
      <div className="no-print">
        <FilterBar className="mb-4" fields={[
          { name: "from", label: type === "payments" || type === "monthly_collections" ? "Payments from" : "Issued from", type: "date" },
          { name: "to", label: "To", type: "date" },
          { name: "currency", label: "Currency", type: "select", options: [{ value: "", label: "All currencies" }, ...cur.map((c) => ({ value: c.currency, label: c.currency }))] },
          { name: "client", label: "Client", type: "select", options: [{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name.slice(0, 36) }))] },
          ...(invoiceReport && type === "outstanding" ? [{ name: "status", label: "Status", type: "select" as const, options: [{ value: "", label: "Any open status" }, ...["sent", "viewed", "partially_paid", "overdue"].map((v) => ({ value: v, label: STATUS_LABEL[v as keyof typeof STATUS_LABEL] }))] }] : []),
        ]} />
      </div>
      <div className="card overflow-hidden">
        {r.rows.length === 0 ? <EmptyState title="No records match these filters">Change the date range or filters. Reports are built live from your invoices, payments and reminders.</EmptyState> : (
          <div className="scroll-x"><table className="tbl">
            <thead><tr>{r.columns.map((c) => <th key={c.key} className={c.align === "right" ? "r" : ""}>{c.label}</th>)}</tr></thead>
            <tbody>{r.rows.map((row, i) => <tr key={i}>{r.columns.map((c) => <td key={c.key} className={`${c.align === "right" ? "r num" : ""} ${c.key === "number" || c.key === "invoice" ? "mono" : ""} ${["client", "reference"].includes(c.key) ? "max-w-[200px] truncate" : ""}`}>{formatCell(c, row)}</td>)}</tr>)}</tbody>
          </table></div>
        )}
        {r.totals.length > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-1 border-t border-line bg-surface2 px-5 py-3 text-[13.5px]">
            {r.totals.map((t) => <span key={t.currency}><span className="text-muted">{t.label} {t.currency}:</span> <b className="num">{formatMoney(t.amount, t.currency)}</b></span>)}
            {r.totals.length > 1 && <span className="text-[12px] text-muted">Currencies are never combined.</span>}
          </div>
        )}
      </div>
      {type === "aging" && <p className="mt-3 text-[12.5px] text-muted">Aging buckets count days past the due date in {s.timezone}. “Not yet due” includes invoices due today.</p>}
    </>
  );
}
