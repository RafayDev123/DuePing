import { ApiError } from "@/lib/api";
import { audit, notify } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { isYmd } from "@/lib/dates";
import { importRow, type ImportRow } from "@/lib/validation";
import { one, rows, sql } from "@/lib/sql";
import { createInvoice } from "@/services/invoices";
import { recordPayment } from "@/services/payments";
import { createClient } from "@/services/clients";
import { toMinor } from "@/lib/money";

export const CSV_FIELDS = [
  { key: "number", label: "Invoice number", required: true, aliases: ["invoice number", "invoice no", "invoice #", "number", "invoice", "inv no", "invoice_number"] },
  { key: "clientName", label: "Client name", required: true, aliases: ["client", "client name", "customer", "customer name", "bill to", "name"] },
  { key: "clientEmail", label: "Client email", required: false, aliases: ["email", "client email", "customer email"] },
  { key: "issueDate", label: "Issue date", required: true, aliases: ["issue date", "date", "invoice date", "issued", "created"] },
  { key: "dueDate", label: "Due date", required: true, aliases: ["due date", "due", "payment due", "due_date"] },
  { key: "currency", label: "Currency", required: true, aliases: ["currency", "cur", "ccy"] },
  { key: "total", label: "Total", required: true, aliases: ["total", "amount", "invoice total", "grand total", "total amount"] },
  { key: "paid", label: "Amount paid", required: false, aliases: ["paid", "amount paid", "payments", "received"] },
  { key: "description", label: "Description", required: false, aliases: ["description", "item", "service", "details", "memo"] },
] as const;

export type FieldKey = (typeof CSV_FIELDS)[number]["key"];
export type Mapping = Partial<Record<FieldKey, number>>;

export function suggestMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const norm = headers.map((h) => h.trim().toLowerCase());
  for (const f of CSV_FIELDS) {
    const idx = norm.findIndex((h, i) => (f.aliases as readonly string[]).includes(h) && !Object.values(m).includes(i));
    if (idx >= 0) m[f.key] = idx;
  }
  return m;
}

export function parseDate(v: string, fmt: "iso" | "dmy" | "mdy"): string | null {
  const s = v.trim();
  if (isYmd(s)) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), m[3]];
    const [d, mo] = fmt === "mdy" ? [b, a] : [a, b];
    const out = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return isYmd(out) ? out : null;
  }
  const t = Date.parse(s + " UTC");
  if (!Number.isNaN(t) && /[a-z]{3}/i.test(s)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

export interface RowResult { line: number; status: "valid" | "invalid" | "duplicate"; errors: string[]; data?: ImportRow; raw: string[] }

export async function validateCsv(wsId: string, text: string, mapping: Mapping, fmt: "iso" | "dmy" | "mdy"): Promise<{ results: RowResult[]; headers: string[]; total: number }> {
  if (text.includes("\u0000")) throw new ApiError(415, "unsupported_file", "File does not look like a text CSV");
  const parsed = parseCsv(text);
  if (parsed.length < 2) throw new ApiError(422, "validation_failed", "The file needs a header row and at least one data row");
  const [headers, ...body] = parsed;
  if (body.length > 2000) throw new ApiError(413, "too_many_rows", "Import is limited to 2,000 rows per file");
  const missing = CSV_FIELDS.filter((f) => f.required && mapping[f.key] === undefined).map((f) => f.label);
  if (missing.length) throw new ApiError(422, "validation_failed", `Map the required columns: ${missing.join(", ")}`);

  const existing = new Set((await rows<{ number: string }>(sql`select number from invoices where workspace_id = ${wsId}`)).map((r) => r.number));
  const seen = new Set<string>();
  const results: RowResult[] = body.map((cells, i) => {
    const get = (k: FieldKey) => (mapping[k] === undefined ? undefined : (cells[mapping[k]!] ?? "").trim());
    const errors: string[] = [];
    const issue = parseDate(get("issueDate") ?? "", fmt);
    const due = parseDate(get("dueDate") ?? "", fmt);
    if (!issue) errors.push("Issue date is not a valid date");
    if (!due) errors.push("Due date is not a valid date");
    const candidate = {
      number: get("number") ?? "", clientName: get("clientName") ?? "", clientEmail: get("clientEmail") || null, issueDate: issue ?? "", dueDate: due ?? "",
      currency: (get("currency") ?? "").toUpperCase(), total: (get("total") ?? "").replace(/[^\d.\-]/g, ""), paid: (get("paid") ?? "").replace(/[^\d.\-]/g, "") || "0", description: get("description") || null,
    };
    const parsedRow = importRow.safeParse(candidate);
    if (!parsedRow.success) for (const is of parsedRow.error.issues) errors.push(`${is.path.join(".") || "row"}: ${is.message}`);
    if (parsedRow.success) {
      const d = parsedRow.data;
      if (d.dueDate < d.issueDate) errors.push("Due date is before issue date");
      if (toMinor(d.paid, d.currency) > toMinor(d.total, d.currency)) errors.push("Paid amount is greater than the total");
    }
    let status: RowResult["status"] = errors.length ? "invalid" : "valid";
    if (!errors.length && parsedRow.success) {
      const n = parsedRow.data.number;
      if (existing.has(n)) { status = "duplicate"; errors.push(`Invoice number ${n} already exists`); }
      else if (seen.has(n)) { status = "duplicate"; errors.push(`Invoice number ${n} appears more than once in this file`); }
      seen.add(n);
    }
    return { line: i + 2, status, errors, data: parsedRow.success ? parsedRow.data : undefined, raw: cells };
  });
  return { results, headers, total: body.length };
}

export async function findOrCreateClient(wsId: string, userId: string, name: string, email: string | null) {
  const hit = email
    ? await one<{ id: string }>(sql`select id from clients where workspace_id = ${wsId} and lower(email) = ${email.toLowerCase()} and archived_at is null limit 1`)
    : await one<{ id: string }>(sql`select id from clients where workspace_id = ${wsId} and lower(name) = ${name.toLowerCase()} and archived_at is null limit 1`);
  if (hit) return hit.id;
  const c = await createClient(wsId, userId, { name, email, businessName: null, phone: null, country: null, billingAddress: null, taxId: null, language: "en", preferredChannel: "email" });
  return c.id;
}

export async function importRows(wsId: string, userId: string, data: ImportRow[], source: "csv" | "pdf") {
  const summary = { created: 0, failed: 0, errors: [] as { number: string; error: string }[] };
  for (const d of data) {
    try {
      const clientId = await findOrCreateClient(wsId, userId, d.clientName, d.clientEmail);
      const inv = await createInvoice(wsId, userId, {
        clientId, title: null, number: d.number, currency: d.currency, issueDate: d.issueDate, dueDate: d.dueDate,
        items: [{ description: d.description || `Imported invoice ${d.number}`, quantity: "1", unitPrice: d.total }],
        discountType: "none", discountValue: "0", taxRate: "0", paymentTerms: null, notes: null, internalNotes: `Imported from ${source.toUpperCase()}`, status: "sent",
      });
      if (toMinor(d.paid, d.currency) > BigInt(0)) {
        await recordPayment(wsId, userId, { invoiceId: inv.id, amount: d.paid, paidAt: d.issueDate, method: "other", reference: "Imported", notes: `Historical payment imported from ${source.toUpperCase()} — verify against your records` });
      }
      summary.created++;
    } catch (e) {
      summary.failed++;
      summary.errors.push({ number: d.number, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
  await audit(wsId, userId, `import.${source}`, "import", undefined, { created: summary.created, failed: summary.failed });
  await notify(wsId, "import_completed", `Import finished: ${summary.created} invoice(s) created`, { body: summary.failed ? `${summary.failed} row(s) failed.` : undefined, link: "/app/invoices" });
  return summary;
}

/* ───────────── PDF extraction (heuristic — always requires human review) ───────────── */

export interface Extraction {
  scanned: boolean;
  fields: { number: string | null; clientName: string | null; clientEmail: string | null; issueDate: string | null; dueDate: string | null; currency: string | null; total: string | null };
  lines: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
  textPreview: string;
}

const SYMBOLS: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "₹": "INR", "₨": "PKR", "Rs": "PKR" };

function findDate(text: string, labels: string[]): string | null {
  const dateRe = "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})";
  for (const l of labels) {
    const m = new RegExp(`${l}\\s*[:\\-]?\\s*${dateRe}`, "i").exec(text);
    if (m) return parseDate(m[1].replace(/,/g, ""), "dmy");
  }
  return null;
}

export function extractFields(text: string): Extraction {
  const t = text.replace(/\r/g, "");
  const flat = t.replace(/[ \t]+/g, " ");
  const num = /invoice\s*(?:no\.?|number|#|num)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]{2,30})/i.exec(flat);
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(flat);
  const billTo = /(?:bill(?:ed)?\s*to|client|customer)\s*[:\-]?\s*\n?\s*([^\n]{2,80})/i.exec(t);
  let currency: string | null = null;
  const code = /\b(USD|EUR|GBP|PKR|AED|SAR|INR|CAD|AUD|SGD|CHF|JPY|CNY|TRY|BDT)\b/.exec(flat);
  if (code) currency = code[1];
  else for (const [sym, c] of Object.entries(SYMBOLS)) if (flat.includes(sym)) { currency = c; break; }
  const totals = [...flat.matchAll(/(?:total\s*due|amount\s*due|balance\s*due|grand\s*total|total)\s*[:\-]?\s*(?:[A-Z]{3}|[$€£₹₨]|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi)].map((m) => m[1].replace(/,/g, ""));
  const total = totals.length ? totals.sort((a, b) => Number(b) - Number(a))[0] : null;
  const lines: Extraction["lines"] = [];
  for (const line of t.split("\n")) {
    const m = /^\s*(.{3,80}?)\s+(\d+(?:\.\d+)?)\s+(?:[A-Z]{3}\s*|[$€£₹₨]\s*)?([\d,]+\.\d{2})\s+(?:[A-Z]{3}\s*|[$€£₹₨]\s*)?([\d,]+\.\d{2})\s*$/.exec(line);
    if (m && !/total|subtotal|tax/i.test(m[1])) lines.push({ description: m[1].trim(), quantity: m[2], unitPrice: m[3].replace(/,/g, ""), lineTotal: m[4].replace(/,/g, "") });
  }
  return {
    scanned: false,
    fields: {
      number: num ? num[1] : null,
      clientName: billTo ? billTo[1].trim() : null,
      clientEmail: email ? email[0].toLowerCase() : null,
      issueDate: findDate(flat, ["issue date", "invoice date", "date of issue", "date"]),
      dueDate: findDate(flat, ["due date", "payment due", "due by", "due"]),
      currency,
      total,
    },
    lines,
    textPreview: t.slice(0, 1500),
  };
}

export async function extractPdf(buffer: Buffer): Promise<Extraction> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let text = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > 30) throw new ApiError(413, "too_many_pages", "PDF has too many pages (max 30)");
    const out = await extractText(pdf, { mergePages: true });
    text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(422, "unreadable_pdf", "This PDF could not be read. It may be damaged or encrypted.");
  }
  if (text.replace(/\s/g, "").length < 40) {
    return { scanned: true, fields: { number: null, clientName: null, clientEmail: null, issueDate: null, dueDate: null, currency: null, total: null }, lines: [], textPreview: "" };
  }
  return extractFields(text);
}
