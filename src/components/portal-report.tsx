"use client";

import { useState } from "react";
import { api, errMsg } from "@/components/api-client";

export function PortalReport({ token, color, disabled }: { token: string; color: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (done) return <p role="status" className="m-0 rounded-md p-4 text-[14px]" style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}>Thank you. The business has been notified and will verify your payment. Your balance will update once they confirm it.</p>;
  return (
    <div>
      {!open ? <button className="btn" disabled={disabled} onClick={() => setOpen(true)}>{disabled ? "Payment report already submitted" : "I've made a payment"}</button> : (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); try { await api(`/api/portal/${token}/report`, { form: new FormData(e.currentTarget) }); setDone(true); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); } }}>
          <p className="m-0 text-[13px] text-muted">Tell the business about your payment. It will be checked against their records before the invoice is marked as paid.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="pr-amt">Amount you paid (optional)</label><input id="pr-amt" name="amount" inputMode="decimal" className="input" /></div>
            <div><label className="label" htmlFor="pr-ref">Transaction reference</label><input id="pr-ref" name="reference" maxLength={120} className="input mono" /></div>
            <div><label className="label" htmlFor="pr-name">Your name</label><input id="pr-name" name="payerName" maxLength={120} className="input" /></div>
            <div><label className="label" htmlFor="pr-file">Proof of payment (optional)</label><input id="pr-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" /></div>
          </div>
          <div><label className="label" htmlFor="pr-msg">Message</label><textarea id="pr-msg" name="message" maxLength={1000} className="textarea" style={{ minHeight: 64 }} /></div>
          <div className="sr-only" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex gap-2"><button className="btn btn-primary" style={{ background: color, borderColor: color }} disabled={busy}>{busy ? "Sending…" : "Send payment report"}</button><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
