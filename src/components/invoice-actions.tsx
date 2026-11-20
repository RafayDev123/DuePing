"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Ban, CalendarClock, CalendarDays, Copy, Download, Link2, Mail, MessageCircle, MoreHorizontal, Printer, Repeat, Send, Wallet, RotateCcw } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { Dropdown, MenuItem, Modal } from "@/components/controls";
import { PaymentDialog, type PayInvoice } from "@/components/payment-dialog";
import { useToast } from "@/components/toast";
import { formatDate } from "@/lib/dates";
import { TEMPLATE_KEYS, TEMPLATE_LABEL } from "@/lib/reminder-templates";

interface Props {
  invoice: { id: string; number: string; currency: string; balance: string; clientName: string; storedStatus: string; status: string; dueDate: string; archived: boolean; hasEmail: boolean; hasPhone: boolean };
  canWrite: boolean;
  canPay: boolean;
  today: string;
  customMethods: string[];
}

type Dlg = "" | "pay" | "email" | "link" | "wa" | "void" | "due" | "recur";

export function InvoiceActions({ invoice: inv, canWrite, canPay, today, customMethods }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dlg, setDlg] = useState<Dlg>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState({ to: "", message: "" });
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [wa, setWa] = useState<{ key: string; url?: string; preview?: string }>({ key: "follow_up" });
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"void" | "cancelled">("void");
  const [due, setDue] = useState(inv.dueDate);
  const [rec, setRec] = useState({ frequency: "monthly", nextRunDate: today, intervalDays: "30", endDate: "" });
  const open = inv.storedStatus === "sent";
  const closed = inv.storedStatus === "void" || inv.storedStatus === "cancelled";
  const payable = open && inv.status !== "paid";

  async function run(fn: () => Promise<void>, ok?: string) {
    setBusy(true); setErr("");
    try { await fn(); if (ok) toast.push("success", ok); router.refresh(); } catch (e) { setErr(errMsg(e)); toast.push("error", errMsg(e)); } finally { setBusy(false); }
  }
  const close = () => { setDlg(""); setErr(""); };
  const payInv: PayInvoice = { id: inv.id, number: inv.number, currency: inv.currency, balance: inv.balance, clientName: inv.clientName };

  async function makeLink() {
    setDlg("link"); setLink(null); setErr(""); setBusy(true);
    try { setLink(await api<{ url: string; expiresAt: string }>(`/api/v1/invoices/${inv.id}/link`, { body: {} })); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function prepWa(key: string) {
    setWa({ key }); setErr(""); setBusy(true);
    try { const r = await api<{ url: string; preview: string }>(`/api/v1/invoices/${inv.id}/whatsapp`, { body: { templateKey: key } }); setWa({ key, url: r.url, preview: r.preview }); router.refresh(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && inv.storedStatus === "draft" && <a className="btn btn-sm" href={`/app/invoices/${inv.id}/edit`}>Edit draft</a>}
        {canWrite && inv.storedStatus === "draft" && <button className="btn btn-sm" disabled={busy} onClick={() => run(() => api(`/api/v1/invoices/${inv.id}/mark-sent`, { body: {} }), "Marked as sent.")}><Send size={14} /> Mark as sent</button>}
        {canWrite && !closed && <button className="btn btn-sm" onClick={() => { setEmail({ to: "", message: "" }); setDlg("email"); }}><Mail size={14} /> Send by email</button>}
        {canPay && payable && <button className="btn btn-primary btn-sm" onClick={() => setDlg("pay")}><Wallet size={14} /> Record payment</button>}
        <a className="btn btn-sm" href={`/api/v1/invoices/${inv.id}/pdf`}><Download size={14} /> PDF</a>
        <a className="btn btn-sm" href={`/api/v1/invoices/${inv.id}/pdf?inline=1`} target="_blank" rel="noopener"><Printer size={14} /> Print</a>
        {canWrite && open && <button className="btn btn-sm" onClick={makeLink}><Link2 size={14} /> Copy link</button>}
        {canWrite && payable && <button className="btn btn-sm" onClick={() => { setDlg("wa"); prepWa("follow_up"); }}><MessageCircle size={14} /> WhatsApp</button>}
        {canWrite && (
          <Dropdown label="More actions" icon={<MoreHorizontal size={16} />}>
            {(c) => (
              <>
                <MenuItem onClick={() => { c(); run(async () => { const r = await api<{ id: string }>(`/api/v1/invoices/${inv.id}/duplicate`, { body: {} }); router.push(`/app/invoices/${r.id}`); }, "Duplicated as a new draft."); }}><Copy size={14} /> Duplicate</MenuItem>
                {!closed && <MenuItem onClick={() => { c(); setDue(inv.dueDate); setDlg("due"); }}><CalendarClock size={14} /> Change due date</MenuItem>}
                {open && <MenuItem onClick={() => { c(); setDlg("recur"); }}><Repeat size={14} /> Make recurring…</MenuItem>}
                {open && <MenuItem onClick={() => { c(); run(async () => { const r = await api<{ revoked: number }>(`/api/v1/invoices/${inv.id}/link`, { method: "DELETE" }); toast.push("success", `${r.revoked} link(s) revoked.`); }); }}><Ban size={14} /> Revoke client links</MenuItem>}
                <MenuItem onClick={() => { c(); run(() => api(`/api/v1/invoices/${inv.id}/archive`, { body: { archived: !inv.archived } }), inv.archived ? "Restored." : "Archived."); }}>{inv.archived ? <><RotateCcw size={14} /> Restore</> : <><Archive size={14} /> Archive</>}</MenuItem>
                {!closed && <MenuItem danger onClick={() => { c(); setReason(""); setDlg("void"); }}><Ban size={14} /> Void or cancel…</MenuItem>}
              </>
            )}
          </Dropdown>
        )}
      </div>

      <PaymentDialog open={dlg === "pay"} onClose={close} invoices={[payInv]} invoiceId={inv.id} today={today} customMethods={customMethods} />

      <Modal open={dlg === "email"} onClose={close} title="Send invoice by email">
        <div className="space-y-4">
          <div><label className="label" htmlFor="em-to">To</label><input id="em-to" className="input" type="email" placeholder={inv.hasEmail ? "Client's email on file" : "Client has no email — enter one"} value={email.to} onChange={(e) => setEmail({ ...email, to: e.target.value })} /></div>
          <div><label className="label" htmlFor="em-msg">Personal message (optional)</label><textarea id="em-msg" className="textarea" value={email.message} onChange={(e) => setEmail({ ...email, message: e.target.value })} /></div>
          <p className="m-0 text-[12.5px] text-muted">The email contains a private link to the invoice. The invoice is marked as sent only after your email provider accepts the message. “Accepted” is not the same as “delivered” — delivery updates appear in the history when the provider reports them.</p>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await api(`/api/v1/invoices/${inv.id}/send`, { body: { to: email.to || null, message: email.message || null } }); close(); }, "Provider accepted the email.")}>{busy ? "Sending…" : "Send email"}</button></div>
        </div>
      </Modal>

      <Modal open={dlg === "link"} onClose={close} title="Private client link">
        {busy && <p>Creating link…</p>}
        {err && <p role="alert" className="field-error">{err}</p>}
        {link && (
          <div className="space-y-3">
            <p className="m-0 text-[13px] text-muted">This link is shown once — only a hash is stored. It expires on <b>{formatDate(link.expiresAt)}</b> and can be revoked at any time.</p>
            <input className="input mono" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Invoice link" />
            <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Close</button><button className="btn btn-primary" onClick={async () => { await navigator.clipboard.writeText(link.url).catch(() => {}); toast.push("success", "Link copied."); }}><Copy size={14} /> Copy link</button></div>
          </div>
        )}
      </Modal>

      <Modal open={dlg === "wa"} onClose={close} title="WhatsApp follow-up">
        <div className="space-y-4">
          <p className="m-0 text-[13px] text-muted">This opens an official WhatsApp click-to-chat link with a prefilled message. You review and press send yourself — DuePing cannot confirm delivery.</p>
          <div><label className="label" htmlFor="wa-t">Message type</label>
            <select id="wa-t" className="select" value={wa.key} onChange={(e) => prepWa(e.target.value)}>{TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}</select></div>
          {busy && <p className="m-0 text-muted">Preparing…</p>}
          {err && <p role="alert" className="field-error">{err}</p>}
          {wa.preview && <pre className="m-0 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface2 p-3 text-[12.5px]" style={{ fontFamily: "inherit" }}>{wa.preview}</pre>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Close</button>
            <a className="btn btn-primary" aria-disabled={!wa.url} href={wa.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (!wa.url) e.preventDefault(); }}><MessageCircle size={14} /> Open in WhatsApp</a></div>
          {!inv.hasPhone && <p className="m-0 text-[12.5px]" style={{ color: "var(--warning-ink)" }}>This client has no phone number saved.</p>}
        </div>
      </Modal>

      <Modal open={dlg === "void"} onClose={close} title="Void or cancel invoice">
        <div className="space-y-4">
          <fieldset className="m-0 border-0 p-0"><legend className="label">Type</legend>
            <label className="mr-5 inline-flex items-center gap-2"><input type="radio" checked={kind === "void"} onChange={() => setKind("void")} /> Void (issued in error)</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={kind === "cancelled"} onChange={() => setKind("cancelled")} /> Cancel (no longer due)</label></fieldset>
          <div><label className="label" htmlFor="v-r">Reason</label><input id="v-r" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <p className="m-0 text-[12.5px] text-muted">Pending reminders are cancelled and client links are revoked. Invoices with recorded payments must have those payments reversed first.</p>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Keep invoice</button><button className="btn btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => run(async () => { await api(`/api/v1/invoices/${inv.id}/void`, { body: { kind, reason } }); close(); }, "Invoice closed.")}>Confirm</button></div>
        </div>
      </Modal>

      <Modal open={dlg === "due"} onClose={close} title="Change due date">
        <div className="space-y-4">
          <div><label className="label" htmlFor="nd">New due date</label><input id="nd" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
          <p className="m-0 text-[12.5px] text-muted">Scheduled reminders will be recalculated for the new date.</p>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await api(`/api/v1/invoices/${inv.id}`, { method: "PATCH", body: { dueDate: due } }); close(); }, "Due date updated.")}>Save</button></div>
        </div>
      </Modal>

      <Modal open={dlg === "recur"} onClose={close} title="Make this invoice recurring">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="rf">Repeats</label><select id="rf" className="select" value={rec.frequency} onChange={(e) => setRec({ ...rec, frequency: e.target.value })}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option><option value="custom">Custom interval</option></select></div>
            {rec.frequency === "custom" ? <div><label className="label" htmlFor="ri">Every (days)</label><input id="ri" className="input" inputMode="numeric" value={rec.intervalDays} onChange={(e) => setRec({ ...rec, intervalDays: e.target.value })} /></div> : <div />}
            <div><label className="label" htmlFor="rn">First invoice on</label><input id="rn" type="date" className="input" value={rec.nextRunDate} onChange={(e) => setRec({ ...rec, nextRunDate: e.target.value })} /></div>
            <div><label className="label" htmlFor="re">Stop after (optional)</label><input id="re" type="date" className="input" value={rec.endDate} onChange={(e) => setRec({ ...rec, endDate: e.target.value })} /></div>
          </div>
          <p className="m-0 text-[12.5px] text-muted"><CalendarDays size={13} className="mr-1 inline" />Each run creates a <b>draft</b> and notifies you. Recurring invoices are never sent automatically.</p>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={close}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => run(async () => { await api("/api/v1/recurring", { body: { fromInvoiceId: inv.id, frequency: rec.frequency, intervalDays: rec.frequency === "custom" ? Number(rec.intervalDays) : null, nextRunDate: rec.nextRunDate, endDate: rec.endDate || null } }); close(); }, "Recurring schedule created. See Settings → Recurring.")}>Create schedule</button></div>
        </div>
      </Modal>
    </>
  );
}

/** Per-payment reverse / correct controls. */
export function LedgerActions({ payment, invoice, today, customMethods }: { payment: { id: string; amount: string; method: string; reference: string | null; paidAt: string }; invoice: PayInvoice; today: string; customMethods: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [dlg, setDlg] = useState<"" | "rev" | "fix">("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Dropdown label="Payment actions">
        {(c) => (<>
          <MenuItem onClick={() => { c(); setDlg("fix"); }}>Correct…</MenuItem>
          <MenuItem danger onClick={() => { c(); setReason(""); setErr(""); setDlg("rev"); }}>Reverse…</MenuItem>
        </>)}
      </Dropdown>
      <Modal open={dlg === "rev"} onClose={() => setDlg("")} title="Reverse payment">
        <div className="space-y-4">
          <p className="m-0 text-[13px] text-muted">A reversal entry is added to the ledger; the original payment stays visible. The invoice balance is restored.</p>
          <div><label className="label" htmlFor="rv">Reason</label><input id="rv" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={() => setDlg("")}>Cancel</button>
            <button className="btn btn-danger" disabled={busy || reason.trim().length < 3} onClick={async () => { setBusy(true); try { await api(`/api/v1/payments/${payment.id}/reverse`, { body: { reason } }); toast.push("success", "Payment reversed."); setDlg(""); router.refresh(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } }}>Reverse payment</button></div>
        </div>
      </Modal>
      <PaymentDialog open={dlg === "fix"} onClose={() => setDlg("")} invoices={[invoice]} invoiceId={invoice.id} today={today} customMethods={customMethods} correct={{ paymentId: payment.id, amount: payment.amount, method: payment.method, reference: payment.reference, paidAt: payment.paidAt }} />
    </>
  );
}

export function AttachmentUpload({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn btn-sm cursor-pointer">
      {busy ? "Uploading…" : "Attach file"}
      <input type="file" className="sr-only" accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        try { const fd = new FormData(); fd.set("file", file); await api(`/api/v1/invoices/${invoiceId}/attachments`, { form: fd }); toast.push("success", "File attached."); router.refresh(); } catch (er) { toast.push("error", errMsg(er)); } finally { setBusy(false); e.target.value = ""; }
      }} />
    </label>
  );
}

export function RequestReview({ req, today, methods }: { req: { id: string; reported_amount: string | null; reference: string | null; balance: string; currency: string; status: string }; today: string; methods: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ amount: req.reported_amount ?? "", method: "bank_transfer", paidAt: today, note: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (action: string, extra: object = {}) => {
    setBusy(true); setErr("");
    try { await api(`/api/v1/payment-requests/${req.id}/review`, { body: { action, ...extra } }); toast.push("success", action === "approve" ? "Approved and recorded in the ledger." : action === "reject" ? "Report rejected." : "Marked under review."); setOpen(false); router.refresh(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {req.status === "pending" && <button className="btn btn-sm" disabled={busy} onClick={() => call("under_review")}>Start review</button>}
        <button className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>Approve…</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => { const note = prompt("Reason for rejecting (optional)") ?? ""; call("reject", { note }); }}>Reject</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Approve payment report">
        <div className="space-y-4">
          <p className="m-0 text-[13px] text-muted">Only approve after you have confirmed the money in your bank or provider account. Enter what you actually received. Remaining balance: <b>{req.balance} {req.currency}</b>.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="ra">Amount received</label><input id="ra" className="input num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><label className="label" htmlFor="rd">Date received</label><input id="rd" type="date" className="input" max={today} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="rm">Method</label><select id="rm" className="select" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{["bank_transfer", "cash", "card", "paypal", "stripe", "wise", "jazzcash", "easypaisa", "other", ...methods].map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}</select></div>
          </div>
          {err && <p role="alert" className="field-error">{err}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => call("approve", { amount: f.amount, method: f.method, paidAt: f.paidAt, note: f.note || null })}>Confirm & record payment</button></div>
        </div>
      </Modal>
    </>
  );
}

export function ReminderRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async (what: "pause" | "resume" | "retry") => {
    setBusy(true);
    try { await api(`/api/v1/reminders/${id}/${what}`, { body: {} }); toast.push("success", what === "retry" ? "Queued for retry." : `Reminder ${what}d.`); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <span className="flex gap-1.5">
      {(status === "pending" || status === "action_needed") && <button className="btn btn-sm" disabled={busy} onClick={() => go("pause")}>Pause</button>}
      {status === "paused" && <button className="btn btn-sm" disabled={busy} onClick={() => go("resume")}>Resume</button>}
      {status === "failed" && <button className="btn btn-sm" disabled={busy} onClick={() => go("retry")}>Retry</button>}
    </span>
  );
}
