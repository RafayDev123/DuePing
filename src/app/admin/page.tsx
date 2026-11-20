import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { rows, one, sql } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform admin", robots: { index: false, follow: false } };

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="card p-4"><p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className="m-0 font-display text-[26px] font-semibold num">{value}</p>{sub && <p className="m-0 text-[12px] text-muted">{sub}</p>}</div>;
}

/** Platform administration. Shows counts and operational health only — never invoice amounts, notes or client data. */
export default async function AdminPage() {
  await requirePlatformAdmin();
  const [users, wsn, subs, usage, emails, queue, failed, errors, worker, storage, audits] = await Promise.all([
    one<{ n: number; verified: number }>(sql`select count(*)::int as n, (count(*) filter (where email_verified_at is not null))::int as verified from users`),
    one<{ n: number }>(sql`select count(*)::int as n from workspaces`),
    rows<{ plan: string; status: string; n: number }>(sql`select plan, status, count(*)::int as n from subscriptions group by 1, 2 order by 3 desc`),
    rows<{ id: string; name: string; invoices: number; clients: number; members: number }>(sql`select w.id, w.name, (select count(*)::int from invoices i where i.workspace_id = w.id) as invoices, (select count(*)::int from clients c where c.workspace_id = w.id) as clients, (select count(*)::int from workspace_members m where m.workspace_id = w.id) as members from workspaces w order by w.created_at desc limit 25`),
    rows<{ status: string; n: number }>(sql`select status, count(*)::int as n from email_deliveries group by 1 order by 2 desc`),
    rows<{ status: string; n: number }>(sql`select status, count(*)::int as n from reminder_schedules group by 1 order by 2 desc`),
    rows<{ id: string; invoice_id: string; last_error: string | null; updated_at: Date; attempts: number }>(sql`select id, invoice_id, last_error, updated_at, attempts from reminder_schedules where status = 'failed' order by updated_at desc limit 10`),
    rows<{ id: string; source: string; message: string; created_at: Date }>(sql`select id, source, message, created_at from system_errors order by created_at desc limit 10`),
    one<{ last_run_at: Date; last_status: string; age: number }>(sql`select last_run_at, last_status, extract(epoch from (now() - last_run_at))::int as age from worker_heartbeats where name = 'main'`),
    one<{ bytes: string | null; n: number }>(sql`select sum(size)::text as bytes, count(*)::int as n from files`),
    rows<{ id: string; action: string; created_at: Date; workspace: string | null }>(sql`select a.id, a.action, a.created_at, w.name as workspace from audit_logs a left join workspaces w on w.id = a.workspace_id order by a.created_at desc limit 15`),
  ]);
  const age = worker ? worker.age : null;
  const healthy = age !== null && age < 300;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <PageHeader title="Platform admin" sub="Operational overview. Customer financial data is deliberately not shown here." crumbs={[{ href: "/app", label: "Back to workspace" }]} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={users?.n ?? 0} sub={`${users?.verified ?? 0} verified`} />
        <Stat label="Workspaces" value={wsn?.n ?? 0} />
        <Stat label="Stored files" value={storage?.n ?? 0} sub={`${((Number(storage?.bytes ?? 0)) / 1024 / 1024).toFixed(2)} MB`} />
        <Stat label="Worker" value={worker ? (healthy ? "Healthy" : "Stale") : "Never ran"} sub={worker ? `last run ${age}s ago` : "start the worker or enable EMBEDDED_WORKER"} />
      </div>
      <div className="mb-5 grid gap-5 md:grid-cols-3">
        <section className="card"><div className="card-h"><h2>Subscriptions</h2></div><ul className="m-0 list-none divide-y divide-line p-0">{subs.map((s, i) => <li key={i} className="flex justify-between px-5 py-2.5 text-[13.5px]"><span>{s.plan} · {s.status}</span><b>{s.n}</b></li>)}</ul><p className="m-0 border-t border-line px-5 py-2 text-[12px] text-muted">Billing provider not connected; all workspaces are on the free plan.</p></section>
        <section className="card"><div className="card-h"><h2>Email deliveries</h2></div><ul className="m-0 list-none divide-y divide-line p-0">{emails.length === 0 && <li className="px-5 py-3 text-muted">None yet</li>}{emails.map((s) => <li key={s.status} className="flex justify-between px-5 py-2.5 text-[13.5px]"><span>{s.status}</span><b>{s.n}</b></li>)}</ul></section>
        <section className="card"><div className="card-h"><h2>Reminder queue</h2></div><ul className="m-0 list-none divide-y divide-line p-0">{queue.length === 0 && <li className="px-5 py-3 text-muted">Empty</li>}{queue.map((s) => <li key={s.status} className="flex justify-between px-5 py-2.5 text-[13.5px]"><span>{s.status}</span><b>{s.n}</b></li>)}</ul></section>
      </div>
      <section className="card mb-5"><div className="card-h"><h2>Workspace usage (counts only)</h2></div><div className="scroll-x"><table className="tbl"><thead><tr><th>Workspace</th><th className="r">Members</th><th className="r">Clients</th><th className="r">Invoices</th></tr></thead><tbody>{usage.map((u) => <tr key={u.id}><td>{u.name}</td><td className="r">{u.members}</td><td className="r">{u.clients}</td><td className="r">{u.invoices}</td></tr>)}</tbody></table></div></section>
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <section className="card"><div className="card-h"><h2>Failed jobs</h2></div>{failed.length === 0 ? <p className="p-5 text-muted">No failed reminder jobs.</p> : <ul className="m-0 list-none divide-y divide-line p-0">{failed.map((f) => <li key={f.id} className="px-5 py-2.5 text-[13px]"><span className="mono">{f.id.slice(0, 8)}</span> · {f.attempts} attempts · {f.last_error ?? "unknown"}<br /><span className="text-muted">{formatDateTime(f.updated_at)}</span></li>)}</ul>}</section>
        <section className="card"><div className="card-h"><h2>System errors</h2></div>{errors.length === 0 ? <p className="p-5 text-muted">No errors logged.</p> : <ul className="m-0 list-none divide-y divide-line p-0">{errors.map((f) => <li key={f.id} className="px-5 py-2.5 text-[13px]"><span className="mono">{f.source}</span> — {f.message}<br /><span className="text-muted">{formatDateTime(f.created_at)}</span></li>)}</ul>}</section>
      </div>
      <section className="card"><div className="card-h"><h2>Recent audit events</h2></div><div className="scroll-x"><table className="tbl"><tbody>{audits.map((a) => <tr key={a.id}><td className="mono">{a.action}</td><td>{a.workspace ?? "—"}</td><td className="text-muted">{formatDateTime(a.created_at)}</td></tr>)}</tbody></table></div></section>
      <p className="mt-4 text-[12px] text-muted"><Link className="link" href="/app">Return to your workspace</Link></p>
    </div>
  );
}
