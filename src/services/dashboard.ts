import { addDays, isYmd, todayInTz } from "@/lib/dates";
import { fromMinor, normalizeAmount, toMinor } from "@/lib/money";
import { one, rows, sql } from "@/lib/sql";
import { buildInvoiceWhere, derivedSql, invoiceBase, listInvoices } from "@/services/invoices";

export const RANGES = ["7d", "30d", "90d", "this_month", "last_month", "custom"] as const;

export function resolveRange(range: string | undefined, tz: string, from?: string, to?: string) {
  const today = todayInTz(tz);
  const r = (RANGES as readonly string[]).includes(range ?? "") ? range! : "30d";
  const first = (d: string) => d.slice(0, 8) + "01";
  if (r === "7d") return { range: r, from: addDays(today, -6), to: today };
  if (r === "90d") return { range: r, from: addDays(today, -89), to: today };
  if (r === "this_month") return { range: r, from: first(today), to: today };
  if (r === "last_month") {
    const lastEnd = addDays(first(today), -1);
    return { range: r, from: first(lastEnd), to: lastEnd };
  }
  if (r === "custom" && from && to && isYmd(from) && isYmd(to) && from <= to) return { range: r, from, to };
  return { range: "30d", from: addDays(today, -29), to: today };
}

export interface DashFilters { range?: string; from?: string; to?: string; currency?: string; clientId?: string; status?: string }

export async function dashboardOverview(wsId: string, tz: string, f: DashFilters) {
  const today = todayInTz(tz);
  const rg = resolveRange(f.range, tz, f.from, f.to);
  const base = { clientId: f.clientId, currency: f.currency };
  const w = buildInvoiceWhere(wsId, today, { ...base, status: f.status });
  const openW = buildInvoiceWhere(wsId, today, base);
  const weekEnd = addDays(today, 6);

  const [outstanding, overdueAgg, weekAgg, partial, invoiceCount, paidRows, recent, overdueList, upcoming, activity, monthly, topClients, recentPayments, reminderStats] = await Promise.all([
    rows<{ currency: string; amount: string; n: number }>(sql`select i.currency, sum(i.total - coalesce(p.paid,0)) as amount, count(*)::int as n ${invoiceBase(wsId)}
      where ${openW} and i.status = 'sent' and i.total - coalesce(p.paid,0) > 0 group by i.currency order by i.currency`),
    rows<{ currency: string; amount: string; n: number }>(sql`select i.currency, sum(i.total - coalesce(p.paid,0)) as amount, count(*)::int as n ${invoiceBase(wsId)}
      where ${openW} and ${derivedSql(today)} = 'overdue' group by i.currency`),
    rows<{ currency: string; amount: string; n: number }>(sql`select i.currency, sum(i.total - coalesce(p.paid,0)) as amount, count(*)::int as n ${invoiceBase(wsId)}
      where ${openW} and i.status = 'sent' and i.total - coalesce(p.paid,0) > 0 and i.due_date between ${today} and ${weekEnd} group by i.currency`),
    one<{ n: number }>(sql`select count(*)::int as n ${invoiceBase(wsId)} where ${openW} and i.status = 'sent' and coalesce(p.paid,0) > 0 and i.total - coalesce(p.paid,0) > 0`),
    one<{ n: number }>(sql`select count(*)::int as n ${invoiceBase(wsId)} where ${w} and i.issue_date between ${rg.from} and ${rg.to}`),
    rows<{ currency: string; amount: string }>(sql`select p.currency, sum(p.amount) as amount from payments p where p.workspace_id = ${wsId} and p.paid_at between ${rg.from} and ${rg.to}
      ${f.currency ? sql`and p.currency = ${f.currency}` : sql``} ${f.clientId ? sql`and p.client_id = ${f.clientId}` : sql``} group by p.currency order by p.currency`),
    listInvoices(wsId, tz, { ...base, status: f.status, from: rg.from, to: rg.to, sort: "created", pageSize: 6 }),
    listInvoices(wsId, tz, { ...base, status: "overdue", sort: "due", dir: "asc", pageSize: 6 }),
    listInvoices(wsId, tz, { ...base, status: f.status && ["sent", "viewed", "partially_paid"].includes(f.status) ? f.status : undefined, dueFrom: today, dueTo: addDays(today, 14), sort: "due", dir: "asc", pageSize: 6 }),
    rows<{ at: Date; kind: string; label: string; detail: string; link: string }>(sql`
      select * from (
        select p.created_at as at, case when p.kind = 'reversal' then 'payment_reversed' else 'payment' end as kind, i.number as label,
          (case when p.kind = 'reversal' then 'Reversal ' else 'Payment ' end) || p.amount::numeric(20,2)::text || ' ' || p.currency as detail, '/app/invoices/' || i.id as link
          from payments p join invoices i on i.id = p.invoice_id where p.workspace_id = ${wsId}
        union all select s.sent_at, 'reminder_sent', i.number, 'Reminder sent via ' || s.channel, '/app/invoices/' || i.id from reminder_schedules s join invoices i on i.id = s.invoice_id where s.workspace_id = ${wsId} and s.status = 'sent' and s.sent_at is not null
        union all select s.updated_at, 'reminder_failed', i.number, 'Reminder failed', '/app/reminders' from reminder_schedules s join invoices i on i.id = s.invoice_id where s.workspace_id = ${wsId} and s.status = 'failed'
        union all select q.created_at, 'payment_reported', i.number, 'Client reported a payment (unverified)', '/app/payments' from payment_verification_requests q join invoices i on i.id = q.invoice_id where q.workspace_id = ${wsId}
        union all select i.sent_at, 'invoice_sent', i.number, 'Invoice marked as sent', '/app/invoices/' || i.id from invoices i where i.workspace_id = ${wsId} and i.sent_at is not null
      ) t order by at desc limit 10`),
    rows<{ month: string; currency: string; amount: string }>(sql`select to_char(date_trunc('month', p.paid_at), 'YYYY-MM') as month, p.currency, sum(p.amount) as amount from payments p
      where p.workspace_id = ${wsId} and p.paid_at >= (date_trunc('month', ${today}::date) - interval '5 months')::date ${f.currency ? sql`and p.currency = ${f.currency}` : sql``} ${f.clientId ? sql`and p.client_id = ${f.clientId}` : sql``}
      group by 1, 2 order by 1`),
    rows<{ client_id: string; name: string; currency: string; amount: string }>(sql`select c.id as client_id, c.name, i.currency, sum(i.total - coalesce(p.paid,0)) as amount ${invoiceBase(wsId)}
      where ${openW} and i.status = 'sent' and i.total - coalesce(p.paid,0) > 0 group by c.id, c.name, i.currency order by sum(i.total - coalesce(p.paid,0)) desc limit 5`),
    rows<{ id: string; invoice_id: string; number: string; client: string; amount: string; currency: string; paid_at: string; method: string; kind: string }>(sql`select p.id, i.id as invoice_id, i.number, c.name as client, p.amount, p.currency, p.paid_at, p.method, p.kind
      from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = p.client_id where p.workspace_id = ${wsId} order by p.created_at desc limit 5`),
    one<{ upcoming: number; failed: number; sent: number }>(sql`select
      (count(*) filter (where status in ('pending','paused','action_needed')))::int as upcoming,
      (count(*) filter (where status = 'failed'))::int as failed,
      (count(*) filter (where status = 'sent' and sent_at::date between ${rg.from} and ${rg.to}))::int as sent from reminder_schedules where workspace_id = ${wsId}`),
  ]);

  const m = (list: { currency: string; amount: string; n?: number }[]) => list.map((x) => ({ currency: x.currency, amount: normalizeAmount(x.amount, x.currency), n: x.n ?? 0 }));
  const totalInvoices = (await one<{ n: number }>(sql`select count(*)::int as n from invoices where workspace_id = ${wsId} and archived_at is null`))!.n;

  return {
    range: rg,
    totalInvoices,
    invoicesInRange: invoiceCount?.n ?? 0,
    outstanding: m(outstanding),
    paid: m(paidRows),
    overdue: m(overdueAgg),
    overdueCount: overdueAgg.reduce((a, b) => a + b.n, 0),
    dueThisWeek: m(weekAgg),
    dueThisWeekCount: weekAgg.reduce((a, b) => a + b.n, 0),
    partiallyPaid: partial?.n ?? 0,
    reminders: reminderStats ?? { upcoming: 0, failed: 0, sent: 0 },
    recent: recent.rows,
    overdueList: overdueList.rows,
    overdueListTotal: overdueList.total,
    upcoming: upcoming.rows,
    activity,
    monthly: monthly.map((x) => ({ month: x.month, currency: x.currency, amount: normalizeAmount(x.amount, x.currency) })),
    topClients: topClients.map((x) => ({ ...x, amount: normalizeAmount(x.amount, x.currency) })),
    recentPayments: recentPayments.map((p) => ({ ...p, amount: normalizeAmount(p.amount, p.currency) })),
  };
}

export const sumMinor = (list: { amount: string; currency: string }[]) => list.reduce((a, b) => a + toMinor(b.amount, b.currency), BigInt(0));
export { fromMinor };
