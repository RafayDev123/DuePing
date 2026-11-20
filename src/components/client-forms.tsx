"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { Modal } from "@/components/controls";
import { useToast } from "@/components/toast";

export interface ClientFormData {
  name: string; businessName: string; email: string; phone: string; country: string; billingAddress: string; taxId: string;
  language: string; preferredChannel: string; whatsappConsent: boolean; remindersPaused: boolean;
}
export const emptyClient: ClientFormData = { name: "", businessName: "", email: "", phone: "", country: "", billingAddress: "", taxId: "", language: "en", preferredChannel: "email", whatsappConsent: false, remindersPaused: false };

function ClientForm({ id, initial, onDone }: { id?: string; initial: ClientFormData; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ClientFormData, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) { setErr("Name is required."); return; }
    setBusy(true);
    try {
      const body = { ...f, email: f.email || null };
      if (id) await api(`/api/v1/clients/${id}`, { method: "PATCH", body });
      else await api("/api/v1/clients", { body });
      toast.push("success", id ? "Client updated." : "Client added.");
      onDone();
      router.refresh();
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">Name</label><input id="c-name" className="input" value={f.name} maxLength={160} onChange={(e) => set("name", e.target.value)} aria-invalid={!f.name && !!err} required /></div>
        <div><label className="label" htmlFor="c-biz">Business name</label><input id="c-biz" className="input" value={f.businessName} onChange={(e) => set("businessName", e.target.value)} /></div>
        <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><label className="label" htmlFor="c-phone">Phone / WhatsApp</label><input id="c-phone" className="input" inputMode="tel" placeholder="+923001234567" value={f.phone} onChange={(e) => set("phone", e.target.value)} /><p className="hint">International format, used for WhatsApp links.</p></div>
        <div><label className="label" htmlFor="c-country">Country</label><input id="c-country" className="input" value={f.country} onChange={(e) => set("country", e.target.value)} /></div>
        <div><label className="label" htmlFor="c-tax">Tax ID (optional)</label><input id="c-tax" className="input" value={f.taxId} onChange={(e) => set("taxId", e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="c-addr">Billing address</label><textarea id="c-addr" className="textarea" style={{ minHeight: 64 }} value={f.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} /></div>
        <div><label className="label" htmlFor="c-lang">Preferred language</label><select id="c-lang" className="select" value={f.language} onChange={(e) => set("language", e.target.value)}><option value="en">English</option><option value="ur">اردو (Urdu)</option><option value="roman_ur">Roman Urdu</option></select></div>
        <div><label className="label" htmlFor="c-ch">Preferred reminder channel</label><select id="c-ch" className="select" value={f.preferredChannel} onChange={(e) => set("preferredChannel", e.target.value)}><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></div>
        <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" className="mt-1" checked={f.whatsappConsent} onChange={(e) => set("whatsappConsent", e.target.checked)} /><span className="text-[13px]">This client has agreed to receive WhatsApp messages from my business. <span className="text-muted">(Required before any automated WhatsApp Business API messaging.)</span></span></label>
        {id && <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" className="mt-1" checked={f.remindersPaused} onChange={(e) => set("remindersPaused", e.target.checked)} /><span className="text-[13px]">Pause all automatic reminders for this client.</span></label>}
      </div>
      {err && <p role="alert" className="field-error">{err}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onDone}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add client"}</button></div>
    </form>
  );
}

export function NewClientButton({ canWrite }: { canWrite: boolean }) {
  const sp = useSearchParams();
  const [open, setOpen] = useState(() => sp.get("new") === "1" && canWrite);
  if (!canWrite) return null;
  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={14} /> New client</button>
      <Modal open={open} onClose={() => setOpen(false)} title="New client" wide><ClientForm initial={emptyClient} onDone={() => setOpen(false)} /></Modal>
    </>
  );
}

export function EditClientButton({ id, initial, archived }: { id: string; initial: ClientFormData; archived: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>Edit</button>
      <button className="btn btn-sm" onClick={async () => {
        if (!archived && !confirm("Archive this client? Their invoices stay, but pending reminders are cancelled.")) return;
        try {
          if (archived) await api(`/api/v1/clients/${id}`, { method: "PATCH", body: {} }).catch(() => {});
          else await api(`/api/v1/clients/${id}`, { method: "DELETE" });
          toast.push("success", "Client archived."); router.push("/app/clients"); router.refresh();
        } catch (e) { toast.push("error", errMsg(e)); }
      }}>{archived ? "Archived" : "Archive"}</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit client" wide><ClientForm id={id} initial={initial} onDone={() => setOpen(false)} /></Modal>
    </>
  );
}

export function NoteForm({ clientId }: { clientId: string }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  return (
    <form className="space-y-2 p-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await api(`/api/v1/clients/${clientId}/notes`, { body: { body } }); setBody(""); router.refresh(); } catch (er) { toast.push("error", errMsg(er)); } finally { setBusy(false); } }}>
      <label className="label" htmlFor="note">Add internal note</label>
      <textarea id="note" className="textarea" style={{ minHeight: 64 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Only your team can see this." />
      <button className="btn btn-sm" disabled={busy || !body.trim()}>Add note</button>
    </form>
  );
}
