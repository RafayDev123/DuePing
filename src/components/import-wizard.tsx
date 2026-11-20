"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText } from "lucide-react";
import { api, errMsg } from "@/components/api-client";
import { useToast } from "@/components/toast";
import { toCsv } from "@/lib/csv";

interface Preview { headers: string[]; sample: string[][]; rowCount: number; suggested: Record<string, number>; fields: { key: string; label: string; required: boolean }[] }
interface Validation { counts: { valid: number; invalid: number; duplicate: number }; results: { line: number; status: string; errors: string[]; raw: string[] }[]; headers: string[] }

function CsvImport() {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pv, setPv] = useState<Preview | null>(null);
  const [map, setMap] = useState<Record<string, number | "">>({});
  const [fmt, setFmt] = useState<"iso" | "dmy" | "mdy">("iso");
  const [val, setVal] = useState<Validation | null>(null);
  const [done, setDone] = useState<{ created: number; failed: number; skippedInvalid: number; skippedDuplicates: number; errors: { number: string; error: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cleanMap = () => Object.fromEntries(Object.entries(map).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(""); setPv(null); setVal(null); setDone(null);
    if (f.size > 1_900_000) { setErr("File is larger than 1.9 MB. Split it into smaller files."); return; }
    if (!/\.(csv|txt)$/i.test(f.name)) { setErr("Please choose a .csv file."); return; }
    const t = await f.text();
    setText(t); setFileName(f.name); setBusy(true);
    try { const p = await api<Preview>("/api/v1/invoices/import/csv", { body: { csv: t, mode: "preview" } }); setPv(p); setMap(p.suggested); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function validate() {
    setBusy(true); setErr("");
    try { setVal(await api<Validation>("/api/v1/invoices/import/csv", { body: { csv: text, mode: "validate", mapping: cleanMap(), dateFormat: fmt } })); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setErr("");
    try { const r = await api<NonNullable<typeof done>>("/api/v1/invoices/import/csv", { body: { csv: text, mode: "commit", mapping: cleanMap(), dateFormat: fmt } }); setDone(r); toast.push("success", `${r.created} invoice(s) imported.`); router.refresh(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  function errorReport() {
    if (!val) return;
    const bad = val.results.filter((r) => r.status !== "valid");
    const csv = toCsv([{ key: "line", label: "Line" }, { key: "status", label: "Status" }, { key: "errors", label: "Problems" }, { key: "raw", label: "Original row" }], bad.map((r) => ({ line: r.line, status: r.status, errors: r.errors.join("; "), raw: r.raw.join(" | ") })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "import-errors.csv";
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="card-b">
        <label className="label" htmlFor="csv-file">1. Choose a CSV file</label>
        <input id="csv-file" type="file" accept=".csv,text/csv,text/plain" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="hint">Needs a header row. Required columns: invoice number, client name, issue date, due date, currency, total. Optional: client email, amount paid, description. Max 2,000 rows. <a className="link" href={`data:text/csv;charset=utf-8,${encodeURIComponent("Invoice Number,Client,Client Email,Issue Date,Due Date,Currency,Total,Paid,Description\nINV-1001,Sample Client,client@example.com,2026-01-05,2026-01-19,USD,500.00,150.00,Website work")}`} download="dueping-import-template.csv">Download a template</a></p>
      </div>
      {busy && <p className="px-5 text-muted">Working…</p>}
      {err && <p role="alert" className="field-error px-5">{err}</p>}

      {pv && !done && (
        <div className="card-b border-t border-line">
          <h3 className="m-0 mb-1 text-[14px] font-semibold">2. Map columns <span className="font-normal text-muted">· {fileName} · {pv.rowCount} rows</span></h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pv.fields.map((f) => (
              <div key={f.key}><label className="label" htmlFor={`m-${f.key}`}>{f.label}{f.required && " *"}</label>
                <select id={`m-${f.key}`} className="select" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === "" ? "" : Number(e.target.value) })}>
                  <option value="">— not in file —</option>{pv.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select></div>
            ))}
            <div><label className="label" htmlFor="m-fmt">Date format in file</label><select id="m-fmt" className="select" value={fmt} onChange={(e) => setFmt(e.target.value as "iso")}><option value="iso">YYYY-MM-DD</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select></div>
          </div>
          <div className="scroll-x mt-4 rounded-md border border-line"><table className="tbl"><thead><tr>{pv.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{pv.sample.map((r, i) => <tr key={i}>{pv.headers.map((_, j) => <td key={j} className="max-w-[180px] truncate">{r[j]}</td>)}</tr>)}</tbody></table></div>
          <button className="btn btn-primary mt-4" disabled={busy} onClick={validate}>Validate rows</button>
        </div>
      )}

      {val && !done && (
        <div className="card-b border-t border-line">
          <h3 className="m-0 mb-3 text-[14px] font-semibold">3. Review and confirm</h3>
          <div className="mb-3 flex flex-wrap gap-2"><span className="badge b-success">{val.counts.valid} ready</span><span className="badge b-warning">{val.counts.duplicate} duplicates (skipped)</span><span className="badge b-danger">{val.counts.invalid} invalid (skipped)</span></div>
          {val.results.some((r) => r.status !== "valid") && (
            <div className="scroll-x mb-3 max-h-72 overflow-y-auto rounded-md border border-line"><table className="tbl"><thead><tr><th>Line</th><th>Status</th><th>Problems</th></tr></thead><tbody>{val.results.filter((r) => r.status !== "valid").slice(0, 100).map((r) => <tr key={r.line}><td>{r.line}</td><td><span className={`badge ${r.status === "duplicate" ? "b-warning" : "b-danger"}`}>{r.status}</span></td><td>{r.errors.join("; ")}</td></tr>)}</tbody></table></div>
          )}
          <p className="m-0 mb-3 text-[12.5px] text-muted">Imported invoices are created as <b>sent</b> historical records. A non-zero “paid” amount is recorded as one payment (method “other”, reference “Imported”) — double-check it against your records.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || val.counts.valid === 0} onClick={commit}>Import {val.counts.valid} invoice{val.counts.valid === 1 ? "" : "s"}</button>
            {val.counts.invalid + val.counts.duplicate > 0 && <button className="btn" onClick={errorReport}>Download error report</button>}
          </div>
        </div>
      )}

      {done && (
        <div className="card-b border-t border-line" role="status">
          <h3 className="m-0 mb-2 text-[15px] font-semibold">Import summary</h3>
          <p className="m-0 text-[13.5px]"><b>{done.created}</b> created · <b>{done.skippedDuplicates}</b> duplicates skipped · <b>{done.skippedInvalid}</b> invalid skipped · <b>{done.failed}</b> failed</p>
          {done.errors.map((e) => <p key={e.number} className="field-error m-0">{e.number}: {e.error}</p>)}
          <Link href="/app/invoices" className="btn btn-primary mt-3">View invoices</Link>
        </div>
      )}
    </div>
  );
}

interface Extraction { scanned: boolean; ocrAvailable: boolean; filename: string; fields: Record<string, string | null>; lines: { description: string; quantity: string; unitPrice: string; lineTotal: string }[]; textPreview: string }

function PdfImport() {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [ex, setEx] = useState<Extraction | null>(null);
  const [f, setF] = useState({ number: "", clientName: "", clientEmail: "", issueDate: "", dueDate: "", currency: "USD", total: "", paid: "0", description: "" });
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function onFile(p: File | undefined) {
    if (!p) return;
    setErr(""); setEx(null); setOk(false); setFile(p);
    if (p.size > 8 * 1024 * 1024) { setErr("PDF is larger than 8 MB."); return; }
    setBusy(true);
    try {
      const fd = new FormData(); fd.set("file", p);
      const r = await api<Extraction>("/api/v1/invoices/import/pdf", { form: fd });
      setEx(r);
      setF({ number: r.fields.number ?? "", clientName: r.fields.clientName ?? "", clientEmail: r.fields.clientEmail ?? "", issueDate: r.fields.issueDate ?? "", dueDate: r.fields.dueDate ?? "", currency: r.fields.currency ?? "USD", total: r.fields.total ?? "", paid: "0", description: r.lines.map((l) => l.description).join("; ").slice(0, 480) });
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.set("file", file); fd.set("fields", JSON.stringify({ ...f, clientEmail: f.clientEmail || null, description: f.description || null }));
      const r = await api<{ id: string }>("/api/v1/invoices/import/pdf/confirm", { form: fd });
      toast.push("success", "Invoice created from your reviewed details."); router.push(`/app/invoices/${r.id}`);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }
  const miss = (k: string) => ex && !ex.fields[k];
  return (
    <div className="space-y-5">
      <div className="card-b">
        <label className="label" htmlFor="pdf-file">1. Upload an invoice PDF</label>
        <input id="pdf-file" type="file" accept="application/pdf" className="input" onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="hint">Text is extracted on the server; the file is validated by content, never executed, and stored privately as an attachment only if you confirm.</p>
      </div>
      {busy && <p className="px-5 text-muted">Working…</p>}
      {err && <p role="alert" className="field-error px-5">{err}</p>}
      {ex?.scanned && (
        <div className="card-b border-t border-line">
          <p className="m-0 text-[13.5px]" role="status"><b>No selectable text found.</b> This looks like a scanned document. {ex.ocrAvailable ? "OCR is configured but not wired in this build." : "OCR is not configured in this deployment (see GUIDE.md → OCR)."} You can still enter the details below by hand and attach this PDF.</p>
        </div>
      )}
      {ex && (
        <div className="card-b border-t border-line">
          <h3 className="m-0 mb-1 text-[14px] font-semibold">2. Review extracted details</h3>
          <p className="m-0 mb-3 text-[12.5px] text-muted">Extraction is a best guess. Fields marked “not found” need your input. Nothing is saved until you confirm.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["number", "Invoice number"], ["clientName", "Client name"], ["clientEmail", "Client email"], ["issueDate", "Issue date"], ["dueDate", "Due date"], ["currency", "Currency"], ["total", "Invoice total"], ["paid", "Already paid"]] as const).map(([k, label]) => (
              <div key={k}><label className="label" htmlFor={`p-${k}`}>{label} {miss(k) && <span className="badge b-warning ml-1" style={{ fontSize: 10 }}>not found</span>}</label>
                <input id={`p-${k}`} className="input" type={k.endsWith("Date") ? "date" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
            ))}
            <div className="sm:col-span-2"><label className="label" htmlFor="p-desc">Description</label><input id="p-desc" className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          </div>
          {ex.lines.length > 0 && <div className="scroll-x mt-3 rounded-md border border-line"><table className="tbl"><thead><tr><th>Detected line</th><th className="r">Qty</th><th className="r">Unit</th><th className="r">Total</th></tr></thead><tbody>{ex.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td className="r">{l.quantity}</td><td className="r">{l.unitPrice}</td><td className="r">{l.lineTotal}</td></tr>)}</tbody></table></div>}
          {ex.textPreview && <details className="mt-3"><summary className="cursor-pointer text-[13px] text-muted">Show extracted text</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface2 p-3 text-[12px]">{ex.textPreview}</pre></details>}
          <label className="mt-4 flex items-start gap-2 text-[13.5px]"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I have checked these details against the original PDF.</label>
          <button className="btn btn-primary mt-3" disabled={!ok || busy} onClick={confirm}>Create invoice</button>
        </div>
      )}
    </div>
  );
}

export function ImportWizard() {
  const [tab, setTab] = useState<"csv" | "pdf">("csv");
  return (
    <div className="card">
      <div role="tablist" aria-label="Import type" className="flex border-b border-line">
        {([["csv", "CSV file", FileSpreadsheet], ["pdf", "Invoice PDF", FileText]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="flex items-center gap-2 px-5 py-3 text-[13.5px] font-medium" style={{ borderBottom: `2px solid ${tab === k ? "var(--accent)" : "transparent"}`, color: tab === k ? "var(--ink)" : "var(--muted)" }}><Icon size={15} /> {label}</button>
        ))}
      </div>
      {tab === "csv" ? <CsvImport /> : <PdfImport />}
    </div>
  );
}
