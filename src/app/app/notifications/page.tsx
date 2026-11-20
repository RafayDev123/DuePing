import Link from "next/link";
import { Bell } from "lucide-react";
import { MarkAllRead, MarkRead } from "@/components/misc-client";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { rows, sql } from "@/lib/sql";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const list = await rows<{ id: string; type: string; title: string; body: string | null; link: string | null; read_at: Date | null; created_at: Date }>(sql`select id, type, title, body, link, read_at, created_at from notifications where workspace_id = ${ctx.ws.id} order by created_at desc limit 100`);
  return (
    <>
      <PageHeader title="Notifications" sub="Due dates, payments, reminders and imports for this workspace." actions={<MarkAllRead disabled={!list.some((n) => !n.read_at)} />} />
      <div className="card">
        {list.length === 0 ? <EmptyState icon={<Bell size={20} />} title="You're all caught up">Notifications appear when invoices approach their due date, payments are recorded or reported, and reminders are sent or fail.</EmptyState> : (
          <ul className="m-0 list-none divide-y divide-line p-0">
            {list.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3.5" style={n.read_at ? { opacity: 0.7 } : undefined}>
                <div className="min-w-0">
                  <p className="m-0 flex items-center gap-2 text-[14px] font-medium">{!n.read_at && <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} aria-label="Unread" />}{n.link ? <Link className="hover:underline" href={n.link}>{n.title}</Link> : n.title}</p>
                  {n.body && <p className="m-0 text-[13px] text-muted">{n.body}</p>}
                  <p className="m-0 text-[12px] text-muted">{formatDateTime(n.created_at, s.timezone)}</p>
                </div>
                {!n.read_at && <MarkRead id={n.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
