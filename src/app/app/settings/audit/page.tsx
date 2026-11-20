import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { rows, sql } from "@/lib/sql";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const ctx = await requireContext();
  if (!can(ctx.role, "settings.manage") && ctx.role !== "accountant") redirect("/app/settings");
  const s = await getSettings(ctx.ws.id);
  const list = await rows<{ id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: Date; actor: string | null; meta: Record<string, unknown> | null }>(sql`
    select a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.name as actor, a.meta from audit_logs a left join users u on u.id = a.actor_id where a.workspace_id = ${ctx.ws.id} order by a.created_at desc limit 200`);
  return (
    <div className="card overflow-hidden">
      <div className="card-h"><h2>Audit log</h2><span className="text-[12px] text-muted">Last 200 financial and security events</span></div>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>{list.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-muted">{formatDateTime(a.created_at, s.timezone)}</td><td>{a.actor ?? "System / client"}</td><td className="mono">{a.action}</td><td className="max-w-[360px] truncate text-[12.5px] text-muted" title={a.meta ? JSON.stringify(a.meta) : ""}>{a.entity_type}{a.meta ? ` · ${JSON.stringify(a.meta)}` : ""}</td></tr>)}</tbody></table></div>
    </div>
  );
}
