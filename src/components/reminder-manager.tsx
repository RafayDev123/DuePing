"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { api, errMsg } from "@/components/api-client";
import { Modal } from "@/components/controls";
import { useToast } from "@/components/toast";
import { DEFAULT_TEMPLATES, LANGUAGE_LABEL, renderTemplate, TEMPLATE_KEYS, TEMPLATE_LABEL, TEMPLATE_VARIABLES, type Language, type TemplateKey } from "@/lib/reminder-templates";

export function AutoReminderPanel({ c, canManage, hasPlatformMailer }: { c: { providerConfigured: boolean; senderVerified: boolean; templatesReviewed: boolean; preferencesConfirmed: boolean; enabled: boolean }; canManage: boolean; hasPlatformMailer: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (action: string, msg: string) => {
    setBusy(true);
    try { await api("/api/v1/reminders/settings", { body: { action } }); toast.push("success", msg); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } finally { setBusy(false); }
  };
  const steps = [
    { done: c.providerConfigured, title: "Configure the sending provider", body: "Add your email provider credentials (stored encrypted).", action: <Link className="btn btn-sm" href="/app/settings/email">Open email settings</Link> },
    { done: c.senderVerified, title: "Verify the sending identity", body: "Send a test email to yourself; the provider must accept it.", action: <Link className="btn btn-sm" href="/app/settings/email">Send test email</Link> },
    { done: c.templatesReviewed, title: "Review the reminder templates", body: "Read every message your clients may receive. Editing a template resets this step.", action: canManage ? <button className="btn btn-sm" disabled={busy} onClick={() => act("confirm_templates", "Templates marked as reviewed.")}>I reviewed them</button> : null },
    { done: c.preferencesConfirmed, title: "Confirm communication preferences", body: "Quiet hours, timezone and send time are correct, and clients expect payment emails.", action: canManage ? <button className="btn btn-sm" disabled={busy} onClick={() => act("confirm_preferences", "Preferences confirmed.")}>Confirm</button> : null },
  ];
  const ready = steps.every((s) => s.done);
  return (
    <section className="card mb-5" aria-labelledby="h-auto">
      <div className="card-h">
        <h2 id="h-auto">Automatic reminders</h2>
        <span className={`badge ${c.enabled ? "b-success" : "b-neutral"}`}>{c.enabled ? "On" : "Off — nothing is sent automatically"}</span>
      </div>
      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface p-4">
            <div className="flex items-start gap-2">
              {s.done ? <CheckCircle2 size={18} style={{ color: "var(--success)" }} className="mt-0.5 shrink-0" aria-label="Done" /> : <Circle size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Not done" />}
              <div><p className="m-0 text-[13.5px] font-semibold">{i + 1}. {s.title}</p><p className="m-0 mt-0.5 text-[12.5px] text-muted">{s.body}</p></div>
            </div>
            {!s.done && s.action}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
        <p className="m-0 max-w-xl text-[12.5px] text-muted">{c.enabled ? "Reminders are scheduled from your rules for every open sent invoice. They stop automatically when an invoice is paid, voided, archived or its client is paused." : ready ? "All checks passed. Turning this on schedules reminders for open sent invoices — only future ones, never a backlog." : "Complete all four steps to enable automatic reminders."}{!hasPlatformMailer && ""}</p>
        {canManage && (c.enabled
          ? <button className="btn" disabled={busy} onClick={() => act("disable", "Automatic reminders turned off. Pending reminders were cancelled.")}>Turn off</button>
          : <button className="btn btn-primary" disabled={busy || !ready} onClick={() => act("enable", "Automatic reminders are on.")}>Enable automatic reminders</button>)}
      </div>
    </section>
  );
}

interface Rule { id: string; name: string; offset_days: number; channel: string; language: string; template_key: string; enabled: boolean }

export function RulesManager({ rules, canManage }: { rules: Rule[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const label = (d: number) => (d === 0 ? "On the due date" : d < 0 ? `${-d} day${d === -1 ? "" : "s"} before due` : `${d} day${d === 1 ? "" : "s"} after due`);
  async function toggle(r: Rule) {
    try { await api(`/api/v1/reminders/rules/${r.id}`, { method: "PATCH", body: { enabled: !r.enabled } }); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); }
  }
  async function save() {
    if (!edit) return;
    setBusy(true); setErr("");
    const body = { name: edit.name ?? "", offsetDays: Number(edit.offset_days ?? 0), channel: edit.channel ?? "email", language: edit.language ?? "client", templateKey: edit.template_key ?? "due_today", enabled: edit.enabled ?? true };
    try {
      if (edit.id) await api(`/api/v1/reminders/rules/${edit.id}`, { method: "PATCH", body });
      else await api("/api/v1/reminders/rules", { body });
      toast.push("success", "Rule saved. Schedules were recalculated."); setEdit(null); router.refresh();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <section className="card" aria-labelledby="h-rules">
      <div className="card-h"><h2 id="h-rules">Reminder rules</h2>{canManage && <button className="btn btn-sm" onClick={() => setEdit({ name: "", offset_days: 0, channel: "email", language: "client", template_key: "due_today", enabled: true })}><Plus size={14} /> Add rule</button>}</div>
      <p className="m-0 border-b border-line px-5 py-3 text-[12.5px] text-muted">Defaults are suggestions, not requirements. Edit, disable or delete any rule. WhatsApp rules create a task for you to review and send manually (unless the official Business API is configured and the client consented).</p>
      <ul className="m-0 list-none divide-y divide-line p-0">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0"><p className="m-0 text-[14px] font-medium">{r.name}</p><p className="m-0 text-[12.5px] text-muted">{label(r.offset_days)} · {TEMPLATE_LABEL[r.template_key as TemplateKey]} · {r.channel} · {r.language === "client" ? "client's language" : LANGUAGE_LABEL[r.language as Language]}</p></div>
            {canManage && (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} /> Enabled</label>
                <button className="btn btn-sm" onClick={() => setEdit(r)}>Edit</button>
                <button className="btn btn-sm btn-ghost btn-icon" aria-label={`Delete rule ${r.name}`} onClick={async () => { if (!confirm(`Delete “${r.name}”?`)) return; try { await api(`/api/v1/reminders/rules/${r.id}`, { method: "DELETE" }); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } }}><Trash2 size={15} /></button>
              </div>
            )}
          </li>
        ))}
        {rules.length === 0 && <li className="p-5 text-[13.5px] text-muted">No rules. Add one to schedule reminders.</li>}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit rule" : "Add rule"}>
        {edit && (
          <div className="space-y-4">
            <div><label className="label" htmlFor="r-n">Name</label><input id="r-n" className="input" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="r-o">Days relative to due date</label><input id="r-o" type="number" className="input" min={-60} max={180} value={edit.offset_days ?? 0} onChange={(e) => setEdit({ ...edit, offset_days: Number(e.target.value) })} /><p className="hint">Negative = before, 0 = due date, positive = after.</p></div>
              <div><label className="label" htmlFor="r-t">Message</label><select id="r-t" className="select" value={edit.template_key} onChange={(e) => setEdit({ ...edit, template_key: e.target.value })}>{TEMPLATE_KEYS.filter((k) => k !== "payment_confirmation").map((k) => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}</select></div>
              <div><label className="label" htmlFor="r-c">Channel</label><select id="r-c" className="select" value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value })}><option value="email">Email (automatic)</option><option value="whatsapp">WhatsApp (manual task)</option></select></div>
              <div><label className="label" htmlFor="r-l">Language</label><select id="r-l" className="select" value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })}><option value="client">Client&apos;s preferred language</option><option value="en">English</option><option value="ur">اردو (Urdu)</option><option value="roman_ur">Roman Urdu</option></select></div>
            </div>
            {err && <p role="alert" className="field-error">{err}</p>}
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" disabled={busy || !(edit.name ?? "").trim()} onClick={save}>Save rule</button></div>
          </div>
        )}
      </Modal>
    </section>
  );
}

export function TemplateEditor({ templates, canManage, businessName }: { templates: Record<string, { subject: string; body: string; custom: boolean }>; canManage: boolean; businessName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [key, setKey] = useState<TemplateKey>("due_today");
  const [lang, setLang] = useState<Language>("en");
  const cur = templates[`${key}:${lang}`] ?? { ...DEFAULT_TEMPLATES[key][lang], custom: false };
  const [subject, setSubject] = useState(cur.subject);
  const [body, setBody] = useState(cur.body);
  const [busy, setBusy] = useState(false);
  const load = (k: TemplateKey, l: Language) => { const t = templates[`${k}:${l}`]; setKey(k); setLang(l); setSubject(t.subject); setBody(t.body); };
  const sample = { client_name: "Sample Client", invoice_number: "DP-2026-0001", remaining_balance: "$250.00", total: "$500.00", due_date: "12 Mar 2026", days_overdue: "3", business_name: businessName, invoice_link: "https://…/portal/private-link" };
  const call = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast.push("success", ok); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); } finally { setBusy(false); } };
  return (
    <section className="card" aria-labelledby="h-tpl">
      <div className="card-h"><h2 id="h-tpl">Message templates</h2></div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="t-k">Message</label><select id="t-k" className="select" value={key} onChange={(e) => load(e.target.value as TemplateKey, lang)}>{TEMPLATE_KEYS.map((k) => <option key={k} value={k}>{TEMPLATE_LABEL[k]}</option>)}</select></div>
            <div><label className="label" htmlFor="t-l">Language</label><select id="t-l" className="select" value={lang} onChange={(e) => load(key, e.target.value as Language)}>{(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}</select></div>
          </div>
          <div><label className="label" htmlFor="t-s">Subject</label><input id="t-s" className="input" dir={lang === "ur" ? "rtl" : "ltr"} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!canManage} /></div>
          <div><label className="label" htmlFor="t-b">Body</label><textarea id="t-b" className="textarea" style={{ minHeight: 220 }} dir={lang === "ur" ? "rtl" : "ltr"} value={body} onChange={(e) => setBody(e.target.value)} disabled={!canManage} /></div>
          <p className="hint">Variables: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join("  ")}. Keep the tone respectful — no threats or pressure.</p>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(() => api("/api/v1/reminders/templates", { method: "PUT", body: { key, language: lang, subject, body } }), "Template saved. Please re-confirm the template review.")}>Save template</button>
              {cur.custom && <button className="btn btn-sm" disabled={busy} onClick={() => call(async () => { await api("/api/v1/reminders/templates", { method: "DELETE", body: { key, language: lang } }); setSubject(DEFAULT_TEMPLATES[key][lang].subject); setBody(DEFAULT_TEMPLATES[key][lang].body); }, "Reset to the default wording.")}>Reset to default</button>}
              <button className="btn btn-sm" disabled={busy} onClick={() => call(() => api("/api/v1/reminders/test-send", { body: { key, language: lang } }), "Test email accepted by the provider — check your inbox.")}>Send test to me</button>
            </div>
          )}
        </div>
        <div>
          <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Preview (sample data)</p>
          <div className="rounded-md border border-line bg-surface2 p-4" dir={lang === "ur" ? "rtl" : "ltr"}>
            <p className="m-0 mb-3 border-b border-line pb-2 text-[13.5px] font-semibold">{renderTemplate(subject, sample)}</p>
            <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed">{renderTemplate(body, sample)}</p>
          </div>
          <p className="hint">Emails are sent as HTML with a plain-text fallback. Test sends are labelled [TEST].</p>
        </div>
      </div>
    </section>
  );
}
