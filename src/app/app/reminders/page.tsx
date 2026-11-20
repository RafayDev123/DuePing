import Link from "next/link";
import { BellRing } from "lucide-react";
import { ReminderRowActions } from "@/components/invoice-actions";
import { AutoReminderPanel, RulesManager, TemplateEditor } from "@/components/reminder-manager";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { addDays, formatDateTime, todayInTz } from "@/lib/dates";
import { platformMailerConfigured } from "@/lib/env";
import { can } from "@/lib/permissions";
import { TEMPLATE_LABEL, type TemplateKey } from "@/lib/reminder-templates";
import { getChecklist, getTemplates, listRules, listSchedules, type ScheduleRow } from "@/services/reminders";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Reminders" };
const TABS = [["schedule", "Schedule"], ["sent", "Sent"], ["failed", "Failed"], ["rules", "Rules"], ["templates", "Templates"]] as const;
const TONE: Record<string, string> = { pending: "b-info", processing: "b-info", sent: "b-success", failed: "b-danger", cancelled: "b-neutral", skipped: "b-neutral", paused: "b-warning", action_needed: "b-accent" };

function Row({ r, tz, canManage }: { r: ScheduleRow; tz: string; canManage: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="m-0 text-[13.5px]"><Link className="mono link" href={`/app/invoices/${r.invoice_id}`}>{r.invoice_number}</Link> · {r.client_name}</p>
        <p className="m-0 text-[12.5px] text-muted">{TEMPLATE_LABEL[r.template_key as TemplateKey] ?? r.template_key} · {r.channel} · {formatDateTime(r.scheduled_at, tz)}{r.attempts > 0 && ` · attempt ${r.attempts}`}</p>
        {(r.last_error || r.delivery_error) && <p className="m-0 text-[12.5px]" style={{ color: "var(--danger-ink)" }}>{r.delivery_error ?? r.last_error}</p>}
        {r.delivery_status && <p className="m-0 text-[12px] text-muted">Provider status: <b>{r.delivery_status}</b>{r.delivery_status === "accepted" ? " (accepted, delivery not yet confirmed)" : ""}</p>}
      </div>
      <div className="flex items-center gap-2"><span className={`badge ${TONE[r.status] ?? "b-neutral"}`}>{r.status.replace("_", " ")}{r.cancel_reason ? ` · ${r.cancel_reason.replace(/_/g, " ")}` : ""}</span>{canManage && <ReminderRowActions id={r.id} status={r.status} />}</div>
    </li>
  );
}

export default async function RemindersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t[0] === sp.tab) ? sp.tab! : "schedule";
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  const canManage = can(ctx.role, "reminders.manage");
  const [check, rules] = await Promise.all([getChecklist(ctx.ws.id), listRules(ctx.ws.id)]);
  const today = todayInTz(s.timezone);

  let body;
  if (tab === "rules") body = <RulesManager rules={rules} canManage={canManage} />;
  else if (tab === "templates") body = <TemplateEditor templates={await getTemplates(ctx.ws.id)} canManage={canManage} businessName={s.businessName} />;
  else if (tab === "sent" || tab === "failed") {
    const list = await listSchedules(ctx.ws.id, tab);
    body = (
      <section className="card">
        {list.length === 0 ? <EmptyState icon={<BellRing size={20} />} title={tab === "sent" ? "No reminders have been sent yet" : "No failed reminders"}>{tab === "sent" ? "Sent reminders appear here with the provider's real delivery status." : "Failures (bounces, provider errors, missing contact details) appear here and can be retried when safe."}</EmptyState> : <ul className="m-0 list-none divide-y divide-line p-0">{list.map((r) => <Row key={r.id} r={r} tz={s.timezone} canManage={canManage} />)}</ul>}
      </section>
    );
  } else {
    const list = await listSchedules(ctx.ws.id, "upcoming");
    // Calendar: five weeks starting from this week's Monday (in workspace timezone)
    const dow = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
    const start = addDays(today, -dow);
    const byDay = new Map<string, ScheduleRow[]>();
    for (const r of list) { const k = todayInTz(s.timezone, new Date(r.scheduled_at)); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
    const days = Array.from({ length: 35 }, (_, i) => addDays(start, i));
    const agenda = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    body = (
      <>
        <section className="card mb-5" aria-labelledby="h-cal">
          <div className="card-h"><h2 id="h-cal">Next five weeks</h2><span className="text-[12px] text-muted">Times in {s.timezone}</span></div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted" aria-hidden>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div>
            <div className="mt-1 grid grid-cols-7 gap-1" role="list" aria-label="Calendar">
              {days.map((d) => {
                const items = byDay.get(d) ?? [];
                return (
                  <div key={d} role="listitem" aria-label={`${d}: ${items.length} reminders`} className="min-h-[58px] rounded-md border p-1.5 sm:min-h-[76px]" style={{ borderColor: d === today ? "var(--accent)" : "var(--line)", background: items.length ? "var(--accent-soft)" : d < today ? "var(--surface-2)" : "var(--surface)", opacity: d < today ? 0.55 : 1 }}>
                    <span className="text-[11.5px] font-semibold">{Number(d.slice(8))}{d.slice(8) === "01" && <span className="ml-1 font-normal text-muted">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(d.slice(5, 7)) - 1]}</span>}</span>
                    {items.length > 0 && <span className="mt-1 block rounded bg-surface px-1 text-[11px] font-semibold" style={{ color: "var(--accent-text)" }}>{items.length}<span className="hidden sm:inline"> reminder{items.length === 1 ? "" : "s"}</span></span>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section className="card" aria-labelledby="h-agenda">
          <div className="card-h"><h2 id="h-agenda">Upcoming reminders</h2><span className="text-[12px] text-muted">{list.length} scheduled</span></div>
          {list.length === 0 ? (
            <EmptyState icon={<BellRing size={20} />} title={check.enabled ? "Nothing scheduled" : "Automatic reminders are off"}>{check.enabled ? "Reminders are created when an invoice is sent and has an open balance." : "No reminder will be sent until you complete the checklist above and enable automatic reminders. You can still follow up manually from any invoice."}</EmptyState>
          ) : agenda.map(([day, items]) => (
            <div key={day}><p className="m-0 border-y border-line bg-surface2 px-5 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted first:border-t-0">{day === today ? "Today" : formatDateTime(new Date(day + "T12:00:00Z"), "UTC").split(",")[0]} · {day}</p><ul className="m-0 list-none divide-y divide-line p-0">{items.map((r) => <Row key={r.id} r={r} tz={s.timezone} canManage={canManage} />)}</ul></div>
          ))}
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Reminders" sub="Respectful, scheduled follow-ups. Nothing is sent until you explicitly enable it." />
      <AutoReminderPanel c={check} canManage={canManage} hasPlatformMailer={platformMailerConfigured()} />
      <nav aria-label="Reminder sections" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([k, label]) => <Link key={k} href={`/app/reminders?tab=${k}`} aria-current={tab === k ? "page" : undefined} className="whitespace-nowrap px-4 py-2.5 text-[13.5px] font-medium" style={{ borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`, color: tab === k ? "var(--ink)" : "var(--muted)" }}>{label}</Link>)}
      </nav>
      {body}
    </>
  );
}
