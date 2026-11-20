import { Repeat } from "lucide-react";
import { RecurringRow } from "@/components/settings-forms";
import { EmptyState } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { listRecurring } from "@/services/recurring";

export const metadata = { title: "Recurring invoices" };

export default async function RecurringPage() {
  const ctx = await requireContext();
  const list = await listRecurring(ctx.ws.id);
  const canWrite = can(ctx.role, "invoices.write");
  return (
    <div className="card">
      {list.length === 0 ? <EmptyState icon={<Repeat size={20} />} title="No recurring invoices">Open a sent invoice and choose “More → Make recurring…”. Each run creates a draft for you to review — nothing is sent automatically.</EmptyState> : (
        <div className="scroll-x"><table className="tbl"><thead><tr><th>Client</th><th>Title</th><th>Repeats</th><th>Next run</th><th>Ends</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((r) => <tr key={r.id}><td>{r.client_name}</td><td className="max-w-[200px] truncate">{r.title ?? "—"}</td><td>{r.frequency === "custom" ? `every ${r.interval_days} days` : r.frequency}</td><td>{formatDate(r.next_run_date)}</td><td>{formatDate(r.end_date)}</td><td><span className={`badge ${r.active ? "b-success" : "b-neutral"}`}>{r.active ? "Active" : "Paused"}</span></td><td className="r">{canWrite && <RecurringRow id={r.id} active={r.active} />}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
