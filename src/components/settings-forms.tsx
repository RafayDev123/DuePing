"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errMsg } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { CURRENCIES } from "@/lib/money";
import { COMMON_TIMEZONES } from "@/lib/dates";
import { ROLES, ROLE_LABEL } from "@/lib/permissions";
import { DemoButton } from "@/components/dashboard-bits";

export interface SettingsData {
  businessName: string; email: string; phone: string; address: string; country: string; taxId: string; website: string; logoDataUrl: string | null; brandColor: string;
  invoiceFooter: string; paymentInstructions: string; defaultCurrency: string; numberFormat: string; paymentTermsDays: number; defaultTaxRate: string; defaultTerms: string;
  timezone: string; quietStart: number; quietEnd: number; reminderSendHour: number; paymentMethods: string;
}

export function SettingsForm({ initial, canEdit }: { initial: SettingsData; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [logoChanged, setLogoChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setF((s) => ({ ...s, [k]: v }));
  const tzs = [...new Set([f.timezone, ...COMMON_TIMEZONES])];

  function onLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setErr("Logo must be a PNG or JPEG."); return; }
    if (file.size > 250 * 1024) { setErr("Logo must be under 250 KB."); return; }
    const r = new FileReader();
    r.onload = () => { set("logoDataUrl", String(r.result)); setLogoChanged(true); setErr(""); };
    r.readAsDataURL(file);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api("/api/v1/workspace/settings", {
        method: "PATCH",
        body: {
          ...f,
          ...(logoChanged ? { logoDataUrl: f.logoDataUrl } : {}),
          logoDataUrl: logoChanged ? f.logoDataUrl : undefined,
          paymentTermsDays: Number(f.paymentTermsDays), quietStart: Number(f.quietStart), quietEnd: Number(f.quietEnd), reminderSendHour: Number(f.reminderSendHour),
          paymentMethods: f.paymentMethods.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      toast.push("success", "Settings saved."); router.refresh();
    } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  }
  const fieldset = !canEdit;
  return (
    <form onSubmit={save} className="space-y-5" noValidate>
      <fieldset disabled={fieldset} className="m-0 space-y-5 border-0 p-0">
        <section className="card"><div className="card-h"><h2>Business details</h2></div>
          <div className="card-b grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-name">Business name</label><input id="s-name" className="input" value={f.businessName} onChange={(e) => set("businessName", e.target.value)} /></div>
            <div><label className="label" htmlFor="s-email">Contact email</label><input id="s-email" type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><label className="label" htmlFor="s-phone">Phone</label><input id="s-phone" className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><label className="label" htmlFor="s-web">Website</label><input id="s-web" className="input" value={f.website} onChange={(e) => set("website", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-addr">Business address</label><textarea id="s-addr" className="textarea" style={{ minHeight: 64 }} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><label className="label" htmlFor="s-country">Country</label><input id="s-country" className="input" value={f.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div><label className="label" htmlFor="s-tax">Tax ID</label><input id="s-tax" className="input" value={f.taxId} onChange={(e) => set("taxId", e.target.value)} /></div>
          </div></section>

        <section className="card"><div className="card-h"><h2>Branding</h2></div>
          <div className="card-b grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-logo">Logo (PNG or JPEG, max 250 KB)</label><input id="s-logo" type="file" accept="image/png,image/jpeg" className="input" onChange={(e) => onLogo(e.target.files?.[0])} />
              {f.logoDataUrl && <div className="mt-2 flex items-center gap-3"><img src={f.logoDataUrl} alt="Current logo" style={{ maxHeight: 44, maxWidth: 140 }} /><button type="button" className="btn btn-sm" onClick={() => { set("logoDataUrl", null); setLogoChanged(true); }}>Remove</button></div>}</div>
            <div><label className="label" htmlFor="s-color">Brand colour</label><div className="flex items-center gap-2"><input id="s-color" type="color" className="h-10 w-14 rounded border border-line bg-transparent" value={f.brandColor} onChange={(e) => set("brandColor", e.target.value)} /><input className="input mono" aria-label="Brand colour hex" value={f.brandColor} onChange={(e) => set("brandColor", e.target.value)} /></div></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-foot">Invoice footer</label><input id="s-foot" className="input" maxLength={500} value={f.invoiceFooter} onChange={(e) => set("invoiceFooter", e.target.value)} placeholder="e.g. Thank you for your business." /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-pay">Payment instructions</label><textarea id="s-pay" className="textarea" value={f.paymentInstructions} onChange={(e) => set("paymentInstructions", e.target.value)} placeholder={"Bank: …\nAccount name: …\nIBAN / account number: …"} /><p className="hint">Shown on PDFs and the client portal. Never enter card numbers or online-banking passwords.</p></div>
          </div></section>

        <section className="card"><div className="card-h"><h2>Invoicing defaults</h2></div>
          <div className="card-b grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-cur">Default currency</label><select id="s-cur" className="select" value={f.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)}>{[...new Set([f.defaultCurrency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label" htmlFor="s-fmt">Invoice number format</label><input id="s-fmt" className="input mono" value={f.numberFormat} onChange={(e) => set("numberFormat", e.target.value)} /><p className="hint">Tokens: {"{YYYY}"} year, {"{NNNN}"} sequence. Example: DP-2026-0001. Sequences restart each year when {"{YYYY}"} is used.</p></div>
            <div><label className="label" htmlFor="s-days">Default payment terms (days)</label><input id="s-days" type="number" min={0} max={365} className="input" value={f.paymentTermsDays} onChange={(e) => set("paymentTermsDays", Number(e.target.value))} /></div>
            <div><label className="label" htmlFor="s-rate">Default tax rate (%)</label><input id="s-rate" className="input num" value={f.defaultTaxRate} onChange={(e) => set("defaultTaxRate", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-terms">Default payment terms text</label><textarea id="s-terms" className="textarea" style={{ minHeight: 64 }} value={f.defaultTerms} onChange={(e) => set("defaultTerms", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-methods">Extra payment methods</label><input id="s-methods" className="input" value={f.paymentMethods} onChange={(e) => set("paymentMethods", e.target.value)} placeholder="Comma separated, e.g. Crypto, Payoneer" /><p className="hint">Added to the built-in list (bank transfer, cash, card, PayPal, Stripe, Wise, JazzCash, Easypaisa, other).</p></div>
          </div></section>

        <section className="card"><div className="card-h"><h2>Time and quiet hours</h2></div>
          <div className="card-b grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4"><label className="label" htmlFor="s-tz">Timezone</label><select id="s-tz" className="select" value={f.timezone} onChange={(e) => set("timezone", e.target.value)}>{tzs.map((t) => <option key={t}>{t}</option>)}</select><p className="hint">Used for due dates, “overdue” status, reports and reminder timing.</p></div>
            <div><label className="label" htmlFor="s-qs">Quiet hours start</label><input id="s-qs" type="number" min={0} max={23} className="input" value={f.quietStart} onChange={(e) => set("quietStart", Number(e.target.value))} /></div>
            <div><label className="label" htmlFor="s-qe">Quiet hours end</label><input id="s-qe" type="number" min={0} max={23} className="input" value={f.quietEnd} onChange={(e) => set("quietEnd", Number(e.target.value))} /></div>
            <div><label className="label" htmlFor="s-sh">Reminder send hour</label><input id="s-sh" type="number" min={0} max={23} className="input" value={f.reminderSendHour} onChange={(e) => set("reminderSendHour", Number(e.target.value))} /></div>
            <p className="hint self-end">Hours are 0–23 local time. Reminders falling in quiet hours move to the end of the quiet window.</p>
          </div></section>
      </fieldset>
      {err && <p role="alert" className="field-error">{err}</p>}
      {canEdit ? <div className="flex justify-end"><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div> : <p className="text-muted">Only owners and admins can change settings.</p>}
    </form>
  );
}

export function EmailIntegrationForm({ initial, platformMailer }: { initial: { from_email: string; from_name: string | null; reply_to: string | null; verified_at: string | null; last_error: string | null; last_test_at: string | null } | null; platformMailer: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ apiKey: "", fromEmail: initial?.from_email ?? "", fromName: initial?.from_name ?? "", replyTo: initial?.reply_to ?? "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (what: string, fn: () => Promise<unknown>, ok: string) => { setBusy(what); setErr(""); try { await fn(); toast.push("success", ok); router.refresh(); } catch (e) { setErr(errMsg(e)); router.refresh(); } finally { setBusy(""); } };
  return (
    <div className="space-y-5">
      <section className="card"><div className="card-h"><h2>Email provider (Resend)</h2>{initial && <span className={`badge ${initial.verified_at ? "b-success" : "b-warning"}`}>{initial.verified_at ? "Sender verified" : "Not verified"}</span>}</div>
        <form className="card-b grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run("save", () => api("/api/v1/integrations/email", { method: "PUT", body: { apiKey: f.apiKey || null, fromEmail: f.fromEmail, fromName: f.fromName || null, replyTo: f.replyTo || null } }).then(() => setF((s) => ({ ...s, apiKey: "" }))), "Saved. Send a test email to verify the sender."); }}>
          <div className="sm:col-span-2"><label className="label" htmlFor="e-key">API key</label><input id="e-key" type="password" autoComplete="off" className="input mono" placeholder={initial ? "•••••••• (stored encrypted — leave blank to keep)" : "re_…"} value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} /><p className="hint">Stored AES-256-GCM encrypted on the server and never sent back to the browser.</p></div>
          <div><label className="label" htmlFor="e-from">Sender email</label><input id="e-from" type="email" className="input" placeholder="billing@yourdomain.com" value={f.fromEmail} onChange={(e) => setF({ ...f, fromEmail: e.target.value })} required /><p className="hint">Must belong to a domain verified in your provider.</p></div>
          <div><label className="label" htmlFor="e-name">Sender name</label><input id="e-name" className="input" value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="e-reply">Reply-to (optional)</label><input id="e-reply" type="email" className="input" value={f.replyTo} onChange={(e) => setF({ ...f, replyTo: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn btn-primary" disabled={!!busy}>{busy === "save" ? "Saving…" : "Save provider"}</button>
            {initial && <button type="button" className="btn" disabled={!!busy} onClick={() => run("test", () => api("/api/v1/integrations/email/test", { body: {} }), "Test email accepted by the provider. Check your inbox.")}>{busy === "test" ? "Sending…" : "Send test email to me"}</button>}
            {initial && <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => { if (confirm("Remove the provider? Automatic reminders will be turned off.")) run("rm", () => api("/api/v1/integrations/email", { method: "DELETE" }), "Provider removed."); }}>Remove</button>}</div>
          {err && <p role="alert" className="field-error sm:col-span-2">{err}</p>}
          {initial?.last_error && <p className="field-error sm:col-span-2">Last provider error: {initial.last_error}</p>}
        </form></section>
      <section className="card card-b text-[13.5px]">
        <h2 className="m-0 mb-2 text-[14px] font-semibold">How delivery status works</h2>
        <ul className="m-0 list-disc space-y-1 pl-5 text-muted"><li><b className="text-ink">Accepted</b> means the provider took the message — not that it reached the inbox.</li><li><b className="text-ink">Delivered / bounced</b> appear only when the provider reports them to the webhook <span className="mono">/api/v1/webhooks/resend</span> (requires <span className="mono">RESEND_WEBHOOK_SECRET</span>).</li><li>Platform account emails (verification, password reset) use a separate mailer: {platformMailer ? "configured" : "not configured — see GUIDE.md"}.</li></ul>
      </section>
    </div>
  );
}

export function TeamManager({ members, invites, me, myRole, canManage }: { members: { id: string; user_id: string; name: string; email: string; role: string }[]; invites: { id: string; email: string; role: string; expires_at: string }[]; me: string; myRole: string; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [inv, setInv] = useState({ email: "", role: "member" });
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.push("success", ok); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } };
  return (
    <div className="space-y-5">
      <section className="card"><div className="card-h"><h2>Members</h2></div>
        <ul className="m-0 list-none divide-y divide-line p-0">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0"><p className="m-0 text-[14px] font-medium">{m.name}{m.user_id === me && <span className="text-muted"> (you)</span>}</p><p className="m-0 text-[12.5px] text-muted">{m.email}</p></div>
              <div className="flex items-center gap-2">
                {canManage && m.role !== "owner" ? (
                  <select className="select" style={{ width: 170 }} aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => act(() => api(`/api/v1/team/${m.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated.")}>{ROLES.filter((r) => r !== "owner" && (myRole === "owner" || r !== "admin")).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}{m.role === "admin" && myRole !== "owner" && <option value="admin">Admin</option>}</select>
                ) : <span className="badge b-accent">{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL] ?? m.role}</span>}
                {canManage && m.role !== "owner" && <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(`Remove ${m.name}?`)) act(() => api(`/api/v1/team/${m.id}`, { method: "DELETE" }), "Member removed."); }}>Remove</button>}
              </div>
            </li>
          ))}
        </ul></section>
      {canManage && (
        <section className="card"><div className="card-h"><h2>Invite someone</h2></div>
          <form className="card-b grid gap-3 sm:grid-cols-[1fr_190px_auto] sm:items-end" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(""); setLink(""); try { const r = await api<{ url: string }>("/api/v1/team", { body: inv }); setLink(r.url); setInv({ ...inv, email: "" }); router.refresh(); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); } }}>
            <div><label className="label" htmlFor="i-e">Email</label><input id="i-e" type="email" className="input" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></div>
            <div><label className="label" htmlFor="i-r">Role</label><select id="i-r" className="select" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{ROLES.filter((r) => r !== "owner" && (myRole === "owner" || r !== "admin")).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></div>
            <button className="btn btn-primary" disabled={busy}>Create invite</button>
            {err && <p role="alert" className="field-error sm:col-span-3">{err}</p>}
            {link && <div className="sm:col-span-3"><p className="m-0 mb-1 text-[12.5px] text-muted">Share this one-time link with them (valid 7 days; they must sign in with that email):</p><input className="input mono" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" /></div>}
          </form>
          <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted"><b className="text-ink">Roles</b> — Owner: everything. Admin: settings, team, reminders. Accountant: invoices, payments, imports. Member: clients and invoices. Viewer: read-only.</div>
          {invites.length > 0 && <ul className="m-0 list-none divide-y divide-line border-t border-line p-0">{invites.map((i) => <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13.5px]"><span>{i.email} <span className="text-muted">· {i.role} · pending</span></span><button className="btn btn-sm" onClick={() => act(() => api(`/api/v1/team/invites/${i.id}`, { method: "DELETE" }), "Invite revoked.")}>Revoke</button></li>)}</ul>}
        </section>
      )}
    </div>
  );
}

export function RecurringRow({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <span className="flex gap-2">
      <button className="btn btn-sm" onClick={async () => { try { await api(`/api/v1/recurring/${id}`, { method: "PATCH", body: { active: !active } }); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } }}>{active ? "Pause" : "Resume"}</button>
      <button className="btn btn-sm btn-danger" onClick={async () => { if (!confirm("Delete this schedule? Already-created invoices stay.")) return; try { await api(`/api/v1/recurring/${id}`, { method: "DELETE" }); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } }}>Delete</button>
    </span>
  );
}

const WORKSPACE_EXPORT_URL = "/api/v1/workspace/export";
const CLIENT_EXPORT_URL = "/api/v1/clients/export";

export function DataControls({ wsName, isOwner, canManage, hasDemo }: { wsName: string; isOwner: boolean; canManage: boolean; hasDemo: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
      <section className="card"><div className="card-h"><h2>Export your data</h2></div><div className="card-b"><p className="mt-0 text-[13.5px] text-muted">Download everything in this workspace — clients, invoices, items, payments, reminders, deliveries and audit log — as JSON. Secrets and file contents are excluded.</p>{canManage ? <a className="btn" href={WORKSPACE_EXPORT_URL}>Download JSON export</a> : <p className="m-0 text-muted">Owners and admins can export data.</p>}<a className="btn ml-2" href={CLIENT_EXPORT_URL}>Clients CSV</a></div></section>
      <section className="card"><div className="card-h"><h2>Demo data</h2></div><div className="card-b flex flex-wrap items-center gap-3"><p className="m-0 max-w-md text-[13.5px] text-muted">Sample clients and invoices labelled “[Demo]”. They are real rows in your database, so remove them before using the workspace for real.</p>{hasDemo ? <DemoButton remove /> : <DemoButton />}</div></section>
      {isOwner && (
        <section className="card" style={{ borderColor: "var(--danger)" }}><div className="card-h"><h2 style={{ color: "var(--danger-ink)" }}>Delete workspace</h2></div>
          <div className="card-b space-y-3"><p className="m-0 text-[13.5px] text-muted">Permanently deletes this business workspace and all of its clients, invoices, payments and files. This cannot be undone. Export first.</p>
            <label className="label" htmlFor="d-n">Type “{wsName}” to confirm</label><input id="d-n" className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            <button className="btn btn-danger" disabled={busy || confirmName !== wsName} onClick={async () => { setBusy(true); try { await api("/api/v1/workspace", { method: "DELETE", body: { confirmName } }); router.push("/app"); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); setBusy(false); } }}>Delete workspace forever</button></div></section>
      )}
    </div>
  );
}
