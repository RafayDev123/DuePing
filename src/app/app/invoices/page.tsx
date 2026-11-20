import Link from "next/link";
import { FilePlus2, FileText, Upload } from "lucide-react";
import { FilterBar } from "@/components/controls";
import { InvoiceTable } from "@/components/invoice-table";
import { EmptyState, PageHeader, Pagination, SearchParamsToQuery } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { rows, sql } from "@/lib/sql";
import { STATUS_LABEL } from "@/lib/status";
import { clientsForSelect } from "@/services/clients";
import { listInvoices } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = sp.sort || "created";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const archived = sp.view === "archived";
  const [res, clients, cur] = await Promise.all([
    listInvoices(ctx.ws.id, s.timezone, { q: sp.q, status: sp.status, clientId: sp.client, currency: sp.currency, sort, dir, page, pageSize: 15, archived }),
    clientsForSelect(ctx.ws.id),
    rows<{ currency: string }>(sql`select distinct currency from invoices where workspace_id = ${ctx.ws.id} order by 1`),
  ]);
  const filtered = !!(sp.q || sp.status || sp.client || sp.currency);

  return (
    <>
      <PageHeader
        title={archived ? "Archived invoices" : "Invoices"}
        sub={`${res.total} ${filtered ? "matching" : archived ? "archived" : "total"} invoice${res.total === 1 ? "" : "s"}`}
        actions={<>
          <Link href={archived ? "/app/invoices" : "/app/invoices?view=archived"} className="btn btn-sm">{archived ? "Back to active" : "Archived"}</Link>
          {can(ctx.role, "import.run") && <Link href="/app/import" className="btn btn-sm"><Upload size={14} /> Import</Link>}
          {can(ctx.role, "invoices.write") && <Link href="/app/invoices/new" className="btn btn-primary btn-sm"><FilePlus2 size={14} /> New invoice</Link>}
        </>}
      />
      <FilterBar className="mb-4" fields={[
        { name: "q", label: "Search", type: "search", placeholder: "Invoice number, client or title" },
        { name: "status", label: "Status", type: "select", options: [{ value: "", label: "All statuses" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))] },
        { name: "client", label: "Client", type: "select", options: [{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name.slice(0, 40) }))] },
        { name: "currency", label: "Currency", type: "select", options: [{ value: "", label: "All" }, ...cur.map((c) => ({ value: c.currency, label: c.currency }))] },
      ]} />
      <div className="card overflow-hidden">
        {res.rows.length === 0 ? (
          <EmptyState icon={<FileText size={20} />} title={filtered ? "No invoices match these filters" : archived ? "No archived invoices" : "No invoices yet"}
            action={!filtered && !archived && can(ctx.role, "invoices.write") ? <><Link href="/app/invoices/new" className="btn btn-primary">Create your first invoice</Link><Link href="/app/import" className="btn">Import from CSV or PDF</Link></> : undefined}>
            {filtered ? "Try removing a filter or searching for a different number or client." : "Invoices you create or import will be listed here with their payment status."}
          </EmptyState>
        ) : (
          <>
            <InvoiceTable rows={res.rows} sort={sort} dir={dir} canWrite={can(ctx.role, "invoices.write")} canPay={can(ctx.role, "payments.write")} today={todayInTz(s.timezone)} customMethods={s.paymentMethods} />
            <div className="border-t border-line"><Pagination page={res.page} pageSize={res.pageSize} total={res.total} base={SearchParamsToQuery(sp)} /></div>
          </>
        )}
      </div>
    </>
  );
}
