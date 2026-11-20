"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/components/api-client";
import { Modal } from "@/components/controls";
import { useToast } from "@/components/toast";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/validation";

export interface PayInvoice { id: string; number: string; currency: string; balance: string; clientName: string }

interface Props {
  open: boolean;
  onClose: () => void;
  invoices: PayInvoice[];
  invoiceId?: string;
  today: string;
  customMethods?: string[];
  correct?: { paymentId: string; amount: string; method: string; reference: string | null; paidAt: string };
  prefill?: { amount?: string; reference?: string | null; method?: string };
  onDone?: () => void;
}

export function PaymentDialog(props: Props) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.correct ? "Correct payment" : "Record payment"}>
      <PaymentForm {...props} />
    </Modal>
  );
}

function PaymentForm({ onClose, invoices, invoiceId, today, customMethods = [], correct, prefill, onDone }: Props) {
  const router = useRouter();
  const toast = useToast();
  const first = invoices.find((x) => x.id === invoiceId) ?? invoices[0];
  const [inv, setInv] = useState(invoiceId ?? first?.id ?? "");
  const [amount, setAmount] = useState(correct ? correct.amount : (prefill?.amount ?? first?.balance ?? ""));
  const [paidAt, setPaidAt] = useState(correct ? correct.paidAt : today);
  const [method, setMethod] = useState(correct ? correct.method : (prefill?.method ?? "bank_transfer"));
  const [reference, setReference] = useState(correct ? (correct.reference ?? "") : (prefill?.reference ?? ""));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cur = invoices.find((x) => x.id === inv);
  const methods = [...PAYMENT_METHODS.map((m) => ({ v: m, l: PAYMENT_METHOD_LABEL[m] })), ...customMethods.map((m) => ({ v: m, l: m }))];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!cur && !correct) { setErr("Choose an invoice."); return; }
    setBusy(true);
    try {
      if (correct) await api(`/api/v1/payments/${correct.paymentId}/correct`, { body: { amount, paidAt, method, reference: reference || null, notes: notes || null } });
      else await api("/api/v1/payments", { body: { invoiceId: inv, amount, paidAt, method, reference: reference || null, notes: notes || null } });
      toast.push("success", correct ? "Payment corrected. The original entry was reversed and kept in the ledger." : "Payment recorded.");
      onClose();
      onDone?.();
      router.refresh();
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
      <form onSubmit={submit} className="space-y-4" noValidate>
        {correct && <p className="m-0 rounded-md bg-[var(--warning-soft)] p-3 text-[13px]" style={{ color: "var(--warning-ink)" }}>Corrections never edit history: the original entry is reversed and a new linked payment is recorded.</p>}
        {!correct && !invoiceId && (
          <div>
            <label className="label" htmlFor="pay-inv">Invoice</label>
            <select id="pay-inv" className="select" value={inv} onChange={(e) => { setInv(e.target.value); setAmount(invoices.find((x) => x.id === e.target.value)?.balance ?? ""); }}>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.number} — {i.clientName} — {formatMoney(i.balance, i.currency)} due</option>)}
            </select>
          </div>
        )}
        {cur && <p className="m-0 text-[13px] text-muted">Remaining balance on <span className="mono">{cur.number}</span>: <b className="num text-ink">{formatMoney(cur.balance, cur.currency)}</b>{correct ? " (before reversing the original payment)" : ""}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="pay-amt">Amount received {cur ? `(${cur.currency})` : ""}</label><input id="pay-amt" className="input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div><label className="label" htmlFor="pay-date">Payment date</label><input id="pay-date" type="date" className="input" value={paidAt} max={today} onChange={(e) => setPaidAt(e.target.value)} required /></div>
          <div><label className="label" htmlFor="pay-method">Method</label><select id="pay-method" className="select" value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
          <div><label className="label" htmlFor="pay-ref">Transaction reference</label><input id="pay-ref" className="input mono" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="pay-notes">Internal notes</label><textarea id="pay-notes" className="textarea" style={{ minHeight: 56 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <p className="m-0 text-[12px] text-muted">Only record money you have confirmed was received. Proof-of-payment files can be attached to the invoice.</p>
        {err && <p role="alert" className="field-error">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : correct ? "Reverse & record correction" : "Record payment"}</button></div>
      </form>
  );
}
