"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Download, FileText, Pencil, Wallet } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { Dropdown, MenuItem } from "@/components/controls";
import { PaymentDialog, type PayInvoice } from "@/components/payment-dialog";
import { useToast } from "@/components/toast";
import { StatusBadge, PaymentStatusBadge } from "@/components/ui";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/dates";
import { formatMoney, toMinor } from "@/lib/money";
import type { InvoiceRow } from "@/services/invoices";

interface Props { rows: InvoiceRow[]; sort: string; dir: string; canWrite: boolean; canPay: boolean; today: string; customMethods: string[] }

export function InvoiceTable({ rows, sort, dir, canWrite, canPay, today, customMethods }: Props) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState<PayInvoice | null>(null);
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const sortHref = (key: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set("sort", key);
    p.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    p.delete("page");
    return `${path}?${p.toString()}`;
  };
  const th = (k: string, children: string, right?: boolean) => (
    <th key={k} className={right ? "r" : ""} aria-sort={sort === k ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={sortHref(k)} className="inline-flex items-center gap-1 hover:text-ink" scroll={false}>{children}{sort === k ? (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} opacity={0.4} />}</Link>
    </th>
  );

  async function bulk(action: "mark_sent" | "archive") {
    setBusy(true);
    try {
      const r = await api<{ done: number; failed: { error: string }[] }>("/api/v1/invoices/bulk", { body: { action, ids: [...sel] } });
      toast.push(r.failed.length ? "error" : "success", `${r.done} updated${r.failed.length ? `, ${r.failed.length} failed: ${r.failed[0].error}` : "."}`);
      setSel(new Set());
      router.refresh();
    } catch (e) { toast.push("error", errMsg(e)); } finally { setBusy(false); }
  }
  function exportSel() {
    const chosen = rows.filter((r) => sel.has(r.id));
    const cols = ["number", "clientName", "issueDate", "dueDate", "currency", "total", "paid", "balance", "status"].map((k) => ({ key: k, label: k }));
    const blob = new Blob([toCsv(cols, chosen as unknown as Record<string, unknown>[])], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invoices-selected.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function copyLink(id: string) {
    try {
      const r = await api<{ url: string; expiresAt: string }>(`/api/v1/invoices/${id}/link`, { body: {} });
      await navigator.clipboard.writeText(r.url);
      toast.push("success", `Private link copied (expires ${formatDate(r.expiresAt)}).`);
    } catch (e) { toast.push("error", errMsg(e)); }
  }
  async function duplicate(id: string) {
    try { const r = await api<{ id: string }>(`/api/v1/invoices/${id}/duplicate`, { body: {} }); toast.push("success", "Duplicated as a draft."); router.push(`/app/invoices/${r.id}`); } catch (e) { toast.push("error", errMsg(e)); }
  }
  const canRecord = (r: InvoiceRow) => canPay && r.storedStatus === "sent" && toMinor(r.balance, r.currency) > BigInt(0);

  const actions = (r: InvoiceRow) => (
    <Dropdown label={`Actions for ${r.number}`}>
      {(close) => (
        <>
          <MenuItem href={`/app/invoices/${r.id}`}><FileText size={14} /> View</MenuItem>
          {canWrite && r.storedStatus === "draft" && <MenuItem href={`/app/invoices/${r.id}/edit`}><Pencil size={14} /> Edit draft</MenuItem>}
          {canRecord(r) && <MenuItem onClick={() => { close(); setPay({ id: r.id, number: r.number, currency: r.currency, balance: r.balance, clientName: r.clientName }); }}><Wallet size={14} /> Record payment</MenuItem>}
          <MenuItem href={`/api/v1/invoices/${r.id}/pdf`}><Download size={14} /> Download PDF</MenuItem>
          {canWrite && r.storedStatus === "sent" && <MenuItem onClick={() => { close(); copyLink(r.id); }}><Copy size={14} /> Copy private link</MenuItem>}
          {canWrite && <MenuItem onClick={() => { close(); duplicate(r.id); }}><Copy size={14} /> Duplicate</MenuItem>}
        </>
      )}
    </Dropdown>
  );

  return (
    <>
      {sel.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 border-b border-line bg-accentsoft px-4 py-2.5 text-[13px]">
          <b>{sel.size} selected</b>
          {canWrite && <button className="btn btn-sm" disabled={busy} onClick={() => bulk("mark_sent")}>Mark as sent</button>}
          {canWrite && <button className="btn btn-sm" disabled={busy} onClick={() => bulk("archive")}>Archive</button>}
          <button className="btn btn-sm" onClick={exportSel}>Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {/* Desktop table */}
      <div className="scroll-x hidden md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}><input type="checkbox" aria-label="Select all invoices on this page" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              {th("number", "Invoice")}{th("client", "Client")}
              {th("issue", "Issued")}{th("due", "Due")}
              {th("total", "Total", true)}{th("paid", "Paid", true)}{th("balance", "Balance", true)}
              <th>Status</th><th className="r"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={sel.has(r.id) ? { background: "var(--accent-soft)" } : undefined}>
                <td><input type="checkbox" aria-label={`Select ${r.number}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                <td><Link href={`/app/invoices/${r.id}`} className="mono font-medium link">{r.number}</Link>{r.isDemo && <span className="badge b-neutral ml-2" style={{ fontSize: 10 }}>Demo</span>}</td>
                <td className="max-w-[200px]"><span className="block truncate" title={r.clientName}>{r.clientName}</span>{r.clientBusiness && <span className="block truncate text-[12px] text-muted">{r.clientBusiness}</span>}</td>
                <td className="whitespace-nowrap text-muted">{formatDate(r.issueDate)}</td>
                <td className="whitespace-nowrap" style={r.status === "overdue" ? { color: "var(--danger-ink)", fontWeight: 600 } : undefined}>{formatDate(r.dueDate)}</td>
                <td className="r num">{formatMoney(r.total, r.currency)}</td>
                <td className="r num text-muted">{formatMoney(r.paid, r.currency)}</td>
                <td className="r num font-semibold">{formatMoney(r.balance, r.currency)}</td>
                <td><div className="flex flex-col items-start gap-1"><StatusBadge status={r.status} />{r.paymentStatus && (r.paymentStatus === "payment_reported" || r.paymentStatus === "under_review") && <PaymentStatusBadge status={r.paymentStatus} />}</div></td>
                <td className="r">{actions(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile compact list */}
      <ul className="m-0 list-none divide-y divide-line p-0 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-3.5">
            <input type="checkbox" className="mt-1.5" style={{ width: 20, height: 20 }} aria-label={`Select ${r.number}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
            <Link href={`/app/invoices/${r.id}`} className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2"><span className="mono text-[13px] font-medium">{r.number}</span><StatusBadge status={r.status} /></span>
              <span className="mt-0.5 block truncate text-[14px]">{r.clientName}</span>
              <span className="mt-1 flex items-center justify-between text-[12.5px] text-muted"><span>Due {formatDate(r.dueDate)}</span><span className="num font-semibold text-ink">{formatMoney(r.balance, r.currency)}</span></span>
            </Link>
            {actions(r)}
          </li>
        ))}
      </ul>

      <PaymentDialog open={!!pay} onClose={() => setPay(null)} invoices={pay ? [pay] : []} invoiceId={pay?.id} today={today} customMethods={customMethods} />
    </>
  );
}
