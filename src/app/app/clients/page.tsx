import Link from "next/link";
import { Download, Users } from "lucide-react";
import { NewClientButton } from "@/components/client-forms";
import { FilterBar } from "@/components/controls";
import { EmptyState, Money, PageHeader, Pagination, SearchParamsToQuery } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listClients } from "@/services/clients";

export const metadata = { title: "Clients" };
const CLIENT_EXPORT_URL = "/api/v1/clients/export";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const res = await listClients(ctx.ws.id, { q: sp.q, filter: sp.filter, page: Math.max(1, Number(sp.page) || 1), pageSize: 20 });
  const canWrite = can(ctx.role, "clients.write");
  const filtered = !!(sp.q || sp.filter);
  return (
    <>
      <PageHeader title="Clients" sub={`${res.total} ${sp.filter === "archived" ? "archived" : "active"} client${res.total === 1 ? "" : "s"}`}
        actions={<><a className="btn btn-sm" href={CLIENT_EXPORT_URL}><Download size={14} /> Export CSV</a><NewClientButton canWrite={canWrite} /></>} />
      <FilterBar className="mb-4" fields={[
        { name: "q", label: "Search", type: "search", placeholder: "Name, business, email or phone" },
        { name: "filter", label: "Show", type: "select", options: [{ value: "", label: "Active clients" }, { value: "owes", label: "With balance due" }, { value: "paused", label: "Reminders paused" }, { value: "whatsapp", label: "Prefer WhatsApp" }, { value: "archived", label: "Archived" }] },
      ]} />
      <div className="card overflow-hidden">
        {res.rows.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title={filtered ? "No clients match" : "No clients yet"} action={!filtered && canWrite ? <Link className="btn btn-primary" href="/app/clients?new=1">Add your first client</Link> : undefined}>
            {filtered ? "Adjust your search or filter." : "Clients hold contact details, preferred language and channel, and every invoice and payment for that relationship."}
          </EmptyState>
        ) : (
          <>
            <div className="scroll-x hidden md:block"><table className="tbl">
              <thead><tr><th>Client</th><th>Contact</th><th className="r">Invoices</th><th className="r">Outstanding</th><th>Flags</th></tr></thead>
              <tbody>{res.rows.map((c) => (
                <tr key={c.id}>
                  <td className="max-w-[260px]"><Link href={`/app/clients/${c.id}`} className="link block truncate font-medium">{c.name}</Link>{c.business_name && <span className="block truncate text-[12px] text-muted">{c.business_name}</span>}</td>
                  <td className="max-w-[240px]"><span className="block truncate">{c.email ?? <span className="text-muted">No email</span>}</span><span className="text-[12px] text-muted">{c.phone ?? ""}</span></td>
                  <td className="r num">{c.invoice_count}</td>
                  <td className="r">{c.outstanding.length ? c.outstanding.map((o) => <div key={o.currency}><Money amount={o.amount} currency={o.currency} className="font-semibold" /></div>) : <span className="text-muted">—</span>}</td>
                  <td>{c.reminders_paused && <span className="badge b-warning">Paused</span>} {c.is_demo && <span className="badge b-neutral">Demo</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
            <ul className="m-0 list-none divide-y divide-line p-0 md:hidden">
              {res.rows.map((c) => (
                <li key={c.id}><Link href={`/app/clients/${c.id}`} className="block px-4 py-3.5">
                  <span className="flex items-center justify-between gap-2"><span className="truncate font-medium">{c.name}</span><span className="text-[12px] text-muted">{c.invoice_count} inv.</span></span>
                  <span className="block truncate text-[12.5px] text-muted">{c.email ?? c.phone ?? "No contact"}</span>
                  {c.outstanding.map((o) => <Money key={o.currency} amount={o.amount} currency={o.currency} className="mr-3 text-[13px] font-semibold" />)}
                </Link></li>
              ))}
            </ul>
            <div className="border-t border-line"><Pagination page={res.page} pageSize={res.pageSize} total={res.total} base={SearchParamsToQuery(sp)} /></div>
          </>
        )}
      </div>
    </>
  );
}
