"use client";

import { useState } from "react";
import { InvoicePreview } from "@/components/invoice-preview";
import { formatMoney } from "@/lib/money";

const TOTAL = 500;
const ROWS = [
  { n: "DP-2026-0001", c: "Northlight Studio", due: "12 Mar 2026", t: 500 },
  { n: "DP-2026-0002", c: "Harbor & Pine", due: "18 Mar 2026", t: 1200 },
  { n: "DP-2026-0003", c: "Kite Analytics", due: "02 Apr 2026", t: 640 },
];

/** Interactive illustration. All values are made-up sample data and are labelled as such. */
export function HeroPreview() {
  const [tab, setTab] = useState<"invoices" | "invoice" | "reminders">("invoice");
  const [pays, setPays] = useState<number[]>([150]);
  const paid = pays.reduce((a, b) => a + b, 0);
  const remaining = TOTAL - paid;
  const tabs = [["invoices", "Invoices"], ["invoice", "Invoice & payments"], ["reminders", "Reminder timeline"]] as const;
  return (
    <div className="card overflow-hidden" aria-label="Interactive product preview">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div role="tablist" aria-label="Preview" className="flex gap-1 overflow-x-auto">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn btn-sm ${tab === k ? "btn-primary" : "btn-ghost"}`}>{l}</button>)}</div>
        <span className="badge b-neutral hidden sm:inline-flex">Sample data</span>
      </div>
      <div className="p-3 sm:p-5">
        {tab === "invoices" && (
          <div className="scroll-x"><table className="tbl"><thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="r">Balance</th><th>Status</th></tr></thead>
            <tbody>{ROWS.map((r, i) => { const bal = i === 0 ? remaining : r.t; return <tr key={r.n}><td className="mono">{r.n}</td><td>{r.c}</td><td className="whitespace-nowrap">{r.due}</td><td className="r num">{formatMoney(bal, "USD")}</td><td>{i === 0 ? <span className={`badge ${remaining === 0 ? "b-success" : paid > 0 ? "b-warning" : "b-info"}`}>{remaining === 0 ? "Paid" : paid > 0 ? "Partially paid" : "Sent"}</span> : i === 1 ? <span className="badge b-danger">Overdue</span> : <span className="badge b-info">Sent</span>}</td></tr>; })}</tbody></table></div>
        )}
        {tab === "invoice" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
            <InvoicePreview d={{ business: { name: "Sample Studio", address: "12 Example Street", email: "hello@example.com", color: "#236B57", footer: "Sample invoice for illustration" }, client: { name: "Northlight Studio", email: "accounts@example.com" }, number: "DP-2026-0001", status: remaining === 0 ? "paid" : paid > 0 ? "partially paid" : "sent", currency: "USD", issueDate: "2026-02-26", dueDate: "2026-03-12", items: [{ description: "Brand identity design", quantity: "1", unitPrice: "500", lineTotal: "500" }], subtotal: "500", discountTotal: "0", taxTotal: "0", taxRate: "0", total: "500", paid: String(paid), balance: String(remaining) }} />
            <div className="space-y-3">
              <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-muted">Payment ledger</p>
              <ul className="m-0 list-none space-y-1 p-0 text-[13.5px]">{pays.map((p, i) => <li key={i} className="flex justify-between border-b border-line pb-1"><span>Payment {i + 1}</span><b className="num">{formatMoney(p, "USD")}</b></li>)}{pays.length === 0 && <li className="text-muted">No payments yet</li>}</ul>
              <p className="m-0 flex justify-between text-[14px]"><span className="text-muted">Remaining</span><b className="num">{formatMoney(remaining, "USD")}</b></p>
              <div className="flex flex-wrap gap-2"><button className="btn btn-primary btn-sm" disabled={remaining <= 0} onClick={() => setPays([...pays, Math.min(200, remaining)])}>Record {formatMoney(Math.min(200, remaining), "USD")}</button><button className="btn btn-sm" onClick={() => setPays([])}>Reset</button></div>
              <p className="m-0 text-[12px] text-muted">Try it: the balance and status update from the ledger — never typed in by hand.</p>
            </div>
          </div>
        )}
        {tab === "reminders" && (
          <ol className="m-0 list-none space-y-3 p-0">
            {[["3 days before", "Upcoming due date", "b-info"], ["Due date", "Friendly reminder", "b-info"], ["+3 days", "First overdue notice", "b-warning"], ["+7 days", "Follow-up", "b-warning"], ["+14 days", "Final polite reminder", "b-danger"]].map(([when, what, tone]) => (
              <li key={when} className="flex items-center gap-4"><span className="w-28 shrink-0 text-[13px] font-semibold">{when}</span><span className="h-px flex-1 bg-[var(--line-strong)]" aria-hidden /><span className={`badge ${tone}`}>{what}</span></li>
            ))}
            <li className="pt-1 text-[12.5px] text-muted">Editable defaults. Reminders stop automatically once an invoice is paid or voided, and nothing is sent until you switch automatic reminders on.</li>
          </ol>
        )}
      </div>
    </div>
  );
}
