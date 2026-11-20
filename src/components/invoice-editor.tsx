"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiClientError, errMsg } from "@/components/api-client";
import { Modal } from "@/components/controls";
import { InvoicePreview, type PreviewData } from "@/components/invoice-preview";
import { useToast } from "@/components/toast";
import { addDays } from "@/lib/dates";
import { computeTotals } from "@/lib/invoicing";
import { CURRENCIES } from "@/lib/money";

interface ClientOpt { id: string; name: string; business_name: string | null; email: string | null; billing_address?: string | null }
interface Item { description: string; quantity: string; unitPrice: string }

export interface EditorInitial {
  id?: string;
  clientId: string;
  title: string;
  number: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  items: Item[];
  discountType: "none" | "percent" | "fixed";
  discountValue: string;
  taxRate: string;
  paymentTerms: string;
  notes: string;
  internalNotes: string;
}

interface Props {
  clients: ClientOpt[];
  initial: EditorInitial;
  termsDays: number;
  business: PreviewData["business"];
  numberHint: string;
  isEdit: boolean;
}

export function InvoiceEditor({ clients: initialClients, initial, termsDays, business, numberHint, isEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState(initialClients);
  const [f, setF] = useState(initial);
  const [dueTouched, setDueTouched] = useState(isEdit);
  const [busy, setBusy] = useState<"" | "draft" | "sent">("");
  const [errors, setErrors] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [nc, setNc] = useState({ name: "", email: "" });
  const [ncErr, setNcErr] = useState("");

  const set = <K extends keyof EditorInitial>(k: K, v: EditorInitial[K]) => setF((s) => ({ ...s, [k]: v }));
  const totals = useMemo(() => {
    try {
      return computeTotals({ currency: f.currency, items: f.items.map((i) => ({ description: i.description, quantity: i.quantity || "0", unitPrice: i.unitPrice || "0" })), discountType: f.discountType, discountValue: f.discountValue || "0", taxRate: f.taxRate || "0" });
    } catch {
      return null;
    }
  }, [f.currency, f.items, f.discountType, f.discountValue, f.taxRate]);
  const client = clients.find((c) => c.id === f.clientId) ?? null;

  const preview: PreviewData = {
    business,
    client: client ? { name: client.name, businessName: client.business_name, email: client.email, address: client.billing_address } : null,
    number: f.number || numberHint,
    title: f.title,
    status: "draft",
    currency: f.currency,
    issueDate: f.issueDate,
    dueDate: f.dueDate,
    items: f.items.map((it, i) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: totals?.lines[i] ?? "0" })),
    subtotal: totals?.subtotal ?? "0",
    discountTotal: totals?.discountTotal ?? "0",
    discountLabel: f.discountType === "percent" ? `Discount (${Number(f.discountValue) || 0}%)` : "Discount",
    taxTotal: totals?.taxTotal ?? "0",
    taxRate: f.taxRate || "0",
    total: totals?.total ?? "0",
    paymentTerms: f.paymentTerms,
    notes: f.notes,
  };

  async function save(status: "draft" | "sent") {
    setErrors([]);
    const local: string[] = [];
    if (!f.clientId) local.push("Choose a client.");
    if (f.items.some((i) => !i.description.trim())) local.push("Every line item needs a description.");
    if (f.items.some((i) => !(Number(i.quantity) > 0))) local.push("Quantities must be greater than zero.");
    if (f.dueDate < f.issueDate) local.push("The due date cannot be before the issue date.");
    if (!totals || Number(totals.total) <= 0) local.push("The invoice total must be greater than zero.");
    if (local.length) { setErrors(local); return; }
    setBusy(status);
    const body = { ...f, number: f.number.trim() || null, items: f.items.map((i) => ({ ...i, unitPrice: i.unitPrice || "0" })), status };
    try {
      const res = await api<{ id: string }>(isEdit ? `/api/v1/invoices/${f.id}` : "/api/v1/invoices", { method: isEdit ? "PATCH" : "POST", body });
      const id = isEdit ? f.id! : res.id;
      toast.push("success", status === "sent" ? "Invoice saved and marked as sent." : "Draft saved.");
      router.push(`/app/invoices/${id}`);
      router.refresh();
    } catch (e) {
      const d = e instanceof ApiClientError && e.details?.length ? e.details.map((x) => `${x.path ? x.path + ": " : ""}${x.message}`) : [errMsg(e)];
      setErrors(d);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy("");
    }
  }

  async function addClient() {
    setNcErr("");
    try {
      const c = await api<ClientOpt>("/api/v1/clients", { body: { name: nc.name, email: nc.email || null } });
      setClients((s) => [...s, c].sort((a, b) => a.name.localeCompare(b.name)));
      set("clientId", c.id);
      setAddOpen(false);
      setNc({ name: "", email: "" });
    } catch (e) {
      setNcErr(errMsg(e));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <div className="space-y-5">
        {errors.length > 0 && (
          <div role="alert" className="card p-4" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
            <p className="m-0 mb-1 text-[13.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>Please fix the following</p>
            <ul className="m-0 list-disc pl-5 text-[13.5px]" style={{ color: "var(--danger-ink)" }}>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <section className="card" aria-labelledby="s-details">
          <div className="card-h"><h2 id="s-details">Invoice details</h2></div>
          <div className="card-b grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="client">Client</label>
              <div className="flex gap-2">
                <select id="client" className="select" value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
                  <option value="">Select a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.business_name ? ` — ${c.business_name}` : ""}</option>)}
                </select>
                <button type="button" className="btn" onClick={() => setAddOpen(true)}><Plus size={15} /> New</button>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="number">Invoice number</label>
              <input id="number" className="input mono" placeholder={numberHint} value={f.number} onChange={(e) => set("number", e.target.value)} />
              <p className="hint">Leave blank to auto-generate. Numbers are unique per business.</p>
            </div>
            <div>
              <label className="label" htmlFor="title">Title (optional)</label>
              <input id="title" className="input" maxLength={200} placeholder="e.g. Website redesign — phase 1" value={f.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="issue">Issue date</label>
              <input id="issue" type="date" className="input" value={f.issueDate} onChange={(e) => { const v = e.target.value; setF((s) => ({ ...s, issueDate: v, dueDate: dueTouched ? s.dueDate : addDays(v, termsDays) })); }} />
            </div>
            <div>
              <label className="label" htmlFor="due">Payment due date</label>
              <input id="due" type="date" className="input" value={f.dueDate} min={f.issueDate} onChange={(e) => { setDueTouched(true); set("dueDate", e.target.value); }} />
            </div>
            <div>
              <label className="label" htmlFor="currency">Currency</label>
              <select id="currency" className="select" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                {[...new Set([f.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="s-items">
          <div className="card-h"><h2 id="s-items">Line items</h2></div>
          <div className="card-b space-y-3">
            {f.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_72px_104px_auto] items-start gap-2 max-sm:grid-cols-2 max-sm:rounded-md max-sm:border max-sm:border-line max-sm:p-3">
                <div className="max-sm:col-span-2">
                  <label className="label sr-only" htmlFor={`d${i}`}>Description {i + 1}</label>
                  <input id={`d${i}`} className="input" placeholder="Description of service or product" value={it.description} maxLength={500} onChange={(e) => set("items", f.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                </div>
                <div>
                  <label className="label sr-only" htmlFor={`q${i}`}>Quantity {i + 1}</label>
                  <input id={`q${i}`} className="input num" inputMode="decimal" placeholder="Qty" value={it.quantity} onChange={(e) => set("items", f.items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                </div>
                <div>
                  <label className="label sr-only" htmlFor={`p${i}`}>Unit price {i + 1}</label>
                  <input id={`p${i}`} className="input num" inputMode="decimal" placeholder="Unit price" value={it.unitPrice} onChange={(e) => set("items", f.items.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
                </div>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Remove item ${i + 1}`} disabled={f.items.length === 1} onClick={() => set("items", f.items.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => set("items", [...f.items, { description: "", quantity: "1", unitPrice: "" }])}><Plus size={14} /> Add line</button>
          </div>
          <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="dtype">Discount</label>
              <select id="dtype" className="select" value={f.discountType} onChange={(e) => set("discountType", e.target.value as EditorInitial["discountType"])}>
                <option value="none">None</option><option value="percent">Percent (%)</option><option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="dval">Discount value</label>
              <input id="dval" className="input num" inputMode="decimal" disabled={f.discountType === "none"} value={f.discountType === "none" ? "" : f.discountValue} onChange={(e) => set("discountValue", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="tax">Tax rate (%)</label>
              <input id="tax" className="input num" inputMode="decimal" value={f.taxRate} onChange={(e) => set("taxRate", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="s-notes">
          <div className="card-h"><h2 id="s-notes">Terms and notes</h2></div>
          <div className="card-b space-y-4">
            <div><label className="label" htmlFor="terms">Payment terms</label><textarea id="terms" className="textarea" style={{ minHeight: 64 }} value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></div>
            <div><label className="label" htmlFor="notes">Notes (visible to client)</label><textarea id="notes" className="textarea" style={{ minHeight: 64 }} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <div><label className="label" htmlFor="inotes">Internal notes (never shown to client)</label><textarea id="inotes" className="textarea" style={{ minHeight: 64 }} value={f.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} /></div>
          </div>
        </section>

        <div className="sticky bottom-0 z-20 -mx-3 flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-3 sm:-mx-6 sm:px-6" style={{ background: "var(--bg)" }}>
          <p className="m-0 text-[13px] text-muted">Total <b className="num text-ink">{totals ? new Intl.NumberFormat("en-US", { style: "currency", currency: f.currency }).format(Number(totals.total)) : "—"}</b></p>
          <div className="flex gap-2">
            <button className="btn" disabled={!!busy} onClick={() => save("draft")}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => save("sent")}>{busy === "sent" ? "Saving…" : "Save & mark as sent"}</button>
          </div>
        </div>
      </div>

      <aside aria-label="Invoice preview" className="min-w-0">
        <div className="xl:sticky xl:top-20">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Live preview · matches the PDF layout</p>
          <InvoicePreview d={preview} />
        </div>
      </aside>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New client">
        <div className="space-y-3">
          <div><label className="label" htmlFor="ncn">Name</label><input id="ncn" className="input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="nce">Email</label><input id="nce" type="email" className="input" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></div>
          {ncErr && <p role="alert" className="field-error">{ncErr}</p>}
          <div className="flex justify-end gap-2"><button className="btn" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={!nc.name.trim()} onClick={addClient}>Add client</button></div>
        </div>
      </Modal>
    </div>
  );
}
