import { diffDays, isYmd, todayInTz } from "@/lib/dates";
import { formatMoney, fromMinor, normalizeAmount, sumByCurrency, toMinor } from "@/lib/money";
import { rows, sql } from "@/lib/sql";
import { listInvoices, type InvoiceRow } from "@/services/invoices";

export const REPORT_TYPES = ["outstanding", "overdue", "payments", "partial", "client_balances", "aging", "reminder_performance", "monthly_collections"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABEL: Record<ReportType, string> = {
  outstanding: "Outstanding invoices",
  overdue: "Overdue invoices",
  payments: "Payments received",
  partial: "Partial payments",
  client_balances: "Client balances",
  aging: "Invoice aging",
  reminder_performance: "Reminder performance",
  monthly_collections: "Monthly collections",
};

export interface Column { key: string; label: string; type?: "money" | "int" | "text"; align?: "left" | "right" }
export interface ReportFilters { from?: string; to?: string; currency?: string; clientId?: string; status?: string }
export interface ReportResult {
  type: ReportType;
  title: string;
  columns: Column[];
  rows: Record<string, string | number | null>[];
  totals: { currency: string; label: string; amount: string }[];
}

const invCols: Column[] = [
  { key: "number", label: "Invoice" }, { key: "client", label: "Client" }, { key: "issueDate", label: "Issued" }, { key: "dueDate", label: "Due" },
  { key: "currency", label: "Cur." }, { key: "total", label: "Total", type: "money", align: "right" }, { key: "paid", label: "Paid", type: "money", align: "right" },
  { key: "balance", label: "Balance", type: "money", align: "right" }, { key: "status", label: "Status" },
];

function invRows(list: InvoiceRow[]) {
  return list.map((i) => ({ number: i.number, client: i.clientName, issueDate: i.issueDate, dueDate: i.dueDate, currency: i.currency, total: i.total, paid: i.paid, balance: i.balance, status: i.status, daysOverdue: i.daysOverdue }));
}

function totalsOf(list: { currency: string; amount: string }[], label: string) {
  return Object.entries(sumByCurrency(list)).map(([currency, amount]) => ({ currency, label, amount }));
}

export async function runReport(wsId: string, tz: string, type: ReportType, f: ReportFilters): Promise<ReportResult> {
  const today = todayInTz(tz);
  const from = f.from && isYmd(f.from) ? f.from : undefined;
  const to = f.to && isYmd(f.to) ? f.to : undefined;
  const base = { clientId: f.clientId, currency: f.currency, from, to, pageSize: 5000, sort: "due", dir: "asc" };
  const title = REPORT_LABEL[type];

  if (type === "outstanding" || type === "overdue" || type === "partial") {
    const { rows: all } = await listInvoices(wsId, tz, base);
    let list = all.filter((i) => ["sent", "viewed", "partially_paid", "overdue"].includes(i.status) && toMinor(i.balance, i.currency) > BigInt(0));
    if (type === "overdue") list = list.filter((i) => i.status === "overdue");
    if (type === "partial") list = list.filter((i) => toMinor(i.paid, i.currency) > BigInt(0));
    if (f.status) list = list.filter((i) => i.status === f.status);
    const columns = type === "overdue" ? [...invCols.slice(0, 8), { key: "daysOverdue", label: "Days late", type: "int" as const, align: "right" as const }] : invCols;
    return { type, title, columns, rows: invRows(list), totals: totalsOf(list.map((i) => ({ currency: i.currency, amount: i.balance })), "Outstanding") };
  }

  if (type === "payments") {
    const r = await rows<{ paid_at: string; invoice: string; client: string; method: string; reference: string | null; currency: string; amount: string; kind: string }>(sql`
      select p.paid_at, i.number as invoice, c.name as client, p.method, p.reference, p.currency, p.amount, p.kind
      from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = p.client_id
      where p.workspace_id = ${wsId} ${from ? sql`and p.paid_at >= ${from}` : sql``} ${to ? sql`and p.paid_at <= ${to}` : sql``}
        ${f.currency ? sql`and p.currency = ${f.currency}` : sql``} ${f.clientId ? sql`and p.client_id = ${f.clientId}` : sql``}
      order by p.paid_at desc, p.created_at desc limit 5000`);
    const data = r.map((x) => ({ date: x.paid_at, invoice: x.invoice, client: x.client, method: x.method.replace(/_/g, " "), reference: x.reference, currency: x.currency, amount: normalizeAmount(x.amount, x.currency), type: x.kind === "reversal" ? "Reversal" : "Payment" }));
    return {
      type, title, rows: data, totals: totalsOf(data.map((d) => ({ currency: d.currency, amount: d.amount })), "Net received"),
      columns: [{ key: "date", label: "Date" }, { key: "invoice", label: "Invoice" }, { key: "client", label: "Client" }, { key: "method", label: "Method" }, { key: "reference", label: "Reference" }, { key: "currency", label: "Cur." }, { key: "amount", label: "Amount", type: "money", align: "right" }, { key: "type", label: "Type" }],
    };
  }

  if (type === "client_balances") {
    const { rows: all } = await listInvoices(wsId, tz, { ...base, from: undefined, to: undefined });
    const map = new Map<string, { client: string; currency: string; count: number; billed: bigint; paid: bigint }>();
    for (const i of all) {
      if (!["sent", "viewed", "partially_paid", "overdue", "paid"].includes(i.status)) continue;
      const k = `${i.clientId}|${i.currency}`;
      const e = map.get(k) ?? { client: i.clientName, currency: i.currency, count: 0, billed: BigInt(0), paid: BigInt(0) };
      e.count++;
      e.billed += toMinor(i.total, i.currency);
      e.paid += toMinor(i.paid, i.currency);
      map.set(k, e);
    }
    const data = [...map.values()].map((e) => ({ client: e.client, currency: e.currency, invoices: e.count, billed: fromMinor(e.billed, e.currency), paid: fromMinor(e.paid, e.currency), balance: fromMinor(e.billed - e.paid, e.currency) })).sort((a, b) => a.client.localeCompare(b.client));
    return {
      type, title, rows: data, totals: totalsOf(data.map((d) => ({ currency: d.currency, amount: d.balance })), "Outstanding"),
      columns: [{ key: "client", label: "Client" }, { key: "currency", label: "Cur." }, { key: "invoices", label: "Invoices", type: "int", align: "right" }, { key: "billed", label: "Billed", type: "money", align: "right" }, { key: "paid", label: "Paid", type: "money", align: "right" }, { key: "balance", label: "Balance", type: "money", align: "right" }],
    };
  }

  if (type === "aging") {
    const { rows: all } = await listInvoices(wsId, tz, { ...base, from: undefined, to: undefined });
    const buckets = ["notDue", "d1_7", "d8_30", "d31_60", "d60plus"] as const;
    const map = new Map<string, Record<(typeof buckets)[number], bigint> & { currency: string; count: number }>();
    for (const i of all) {
      if (!["sent", "viewed", "partially_paid", "overdue"].includes(i.status)) continue;
      const bal = toMinor(i.balance, i.currency);
      if (bal <= BigInt(0)) continue;
      const late = diffDays(i.dueDate, today);
      const b = late <= 0 ? "notDue" : late <= 7 ? "d1_7" : late <= 30 ? "d8_30" : late <= 60 ? "d31_60" : "d60plus";
      const e = map.get(i.currency) ?? { currency: i.currency, count: 0, notDue: BigInt(0), d1_7: BigInt(0), d8_30: BigInt(0), d31_60: BigInt(0), d60plus: BigInt(0) };
      e[b] += bal;
      e.count++;
      map.set(i.currency, e);
    }
    const data = [...map.values()].map((e) => {
      const c = e.currency;
      const tot = buckets.reduce((a, k) => a + e[k], BigInt(0));
      return { currency: c, count: e.count, notDue: fromMinor(e.notDue, c), d1_7: fromMinor(e.d1_7, c), d8_30: fromMinor(e.d8_30, c), d31_60: fromMinor(e.d31_60, c), d60plus: fromMinor(e.d60plus, c), total: fromMinor(tot, c) };
    });
    return {
      type, title, rows: data, totals: [],
      columns: [{ key: "currency", label: "Cur." }, { key: "count", label: "Open", type: "int", align: "right" }, { key: "notDue", label: "Not yet due", type: "money", align: "right" }, { key: "d1_7", label: "1–7 days", type: "money", align: "right" }, { key: "d8_30", label: "8–30 days", type: "money", align: "right" }, { key: "d31_60", label: "31–60 days", type: "money", align: "right" }, { key: "d60plus", label: "60+ days", type: "money", align: "right" }, { key: "total", label: "Total open", type: "money", align: "right" }],
    };
  }

  if (type === "reminder_performance") {
    const r = await rows<Record<string, number | string>>(sql`
      select s.template_key as template, s.channel,
        count(*)::int as scheduled,
        (count(*) filter (where s.status = 'sent'))::int as sent,
        (count(*) filter (where s.status = 'failed'))::int as failed,
        (count(*) filter (where s.status in ('cancelled','skipped')))::int as cancelled,
        (count(*) filter (where s.status in ('pending','paused','action_needed','processing')))::int as upcoming,
        (select count(*)::int from email_deliveries d join reminder_schedules s2 on s2.id = d.schedule_id where s2.template_key = s.template_key and s2.channel = s.channel and d.workspace_id = ${wsId} and d.status = 'delivered') as delivered,
        (select count(*)::int from email_deliveries d join reminder_schedules s2 on s2.id = d.schedule_id where s2.template_key = s.template_key and s2.channel = s.channel and d.workspace_id = ${wsId} and d.status in ('bounced','complained')) as bounced
      from reminder_schedules s where s.workspace_id = ${wsId} ${from ? sql`and s.scheduled_at::date >= ${from}` : sql``} ${to ? sql`and s.scheduled_at::date <= ${to}` : sql``}
      group by s.template_key, s.channel order by s.template_key`);
    return {
      type, title, rows: r, totals: [],
      columns: [{ key: "template", label: "Template" }, { key: "channel", label: "Channel" }, { key: "scheduled", label: "Scheduled", type: "int", align: "right" }, { key: "sent", label: "Sent (accepted)", type: "int", align: "right" }, { key: "delivered", label: "Delivered (confirmed)", type: "int", align: "right" }, { key: "bounced", label: "Bounced", type: "int", align: "right" }, { key: "failed", label: "Failed", type: "int", align: "right" }, { key: "cancelled", label: "Cancelled / skipped", type: "int", align: "right" }, { key: "upcoming", label: "Upcoming", type: "int", align: "right" }],
    };
  }

  // monthly_collections
  const r = await rows<{ month: string; currency: string; amount: string; n: number }>(sql`
    select to_char(date_trunc('month', p.paid_at), 'YYYY-MM') as month, p.currency, sum(p.amount) as amount, (count(*) filter (where p.kind = 'payment'))::int as n
    from payments p where p.workspace_id = ${wsId} ${from ? sql`and p.paid_at >= ${from}` : sql``} ${to ? sql`and p.paid_at <= ${to}` : sql``}
      ${f.currency ? sql`and p.currency = ${f.currency}` : sql``} ${f.clientId ? sql`and p.client_id = ${f.clientId}` : sql``}
    group by 1, 2 order by 1 desc, 2`);
  const data = r.map((x) => ({ month: x.month, currency: x.currency, payments: x.n, amount: normalizeAmount(x.amount, x.currency) }));
  return {
    type, title, rows: data, totals: totalsOf(data.map((d) => ({ currency: d.currency, amount: d.amount })), "Collected"),
    columns: [{ key: "month", label: "Month" }, { key: "currency", label: "Cur." }, { key: "payments", label: "Payments", type: "int", align: "right" }, { key: "amount", label: "Collected (net)", type: "money", align: "right" }],
  };
}

export function formatCell(col: Column, row: Record<string, string | number | null>): string {
  const v = row[col.key];
  if (v === null || v === undefined) return "";
  if (col.type === "money") return formatMoney(String(v), String(row.currency ?? "USD"));
  return String(v);
}
