import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { currencyDecimals } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export interface PdfInvoice {
  business: { name: string; email: string | null; phone: string | null; address: string | null; taxId: string | null; website: string | null; logoDataUrl: string | null; color: string; footer: string | null; paymentInstructions: string | null };
  client: { name: string; businessName: string | null; email: string | null; address: string | null; taxId: string | null };
  invoice: {
    number: string; title: string | null; currency: string; issueDate: string; dueDate: string; status: string;
    items: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
    subtotal: string; discountTotal: string; discountLabel: string; taxTotal: string; taxRate: string; total: string; paid: string; balance: string;
    notes: string | null; paymentTerms: string | null;
  };
  payments: { date: string; method: string; amount: string; kind: string }[];
}

/** Standard PDF fonts only support WinAnsi; replace anything else so generation never throws. */
export function pdfSafe(s: string | null | undefined): string {
  return (s ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/\t/g, " ")
    .replace(/[^\n\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

export function pdfMoney(amount: string | number, currency: string): string {
  const d = currencyDecimals(currency);
  return `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(amount))}`;
}

function hexToRgb(hex: string) {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#236B57";
  return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        if (line) { out.push(line); line = ""; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

const INK = rgb(0.09, 0.13, 0.12);
const MUTED = rgb(0.455, 0.502, 0.475);
const LINE = rgb(0.898, 0.906, 0.875);

export async function renderInvoicePdf(d: PdfInvoice): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${pdfSafe(d.invoice.number)}`);
  pdf.setProducer("DuePing");
  pdf.setCreator("DuePing");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const brand = hexToRgb(d.business.color);
  const W = 595.28, H = 841.89, M = 48;
  const cur = d.invoice.currency;

  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (d.business.logoDataUrl) {
    try {
      const [, kind, b64] = /^data:image\/(png|jpeg);base64,(.+)$/.exec(d.business.logoDataUrl) ?? [];
      if (b64) logo = kind === "png" ? await pdf.embedPng(Buffer.from(b64, "base64")) : await pdf.embedJpg(Buffer.from(b64, "base64"));
    } catch {
      logo = null;
    }
  }

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const text = (t: string, x: number, yy: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; right?: boolean } = {}) => {
    const font = o.font ?? regular, size = o.size ?? 10;
    const s = pdfSafe(t);
    const px = o.right ? x - font.widthOfTextAtSize(s, size) : x;
    page.drawText(s, { x: px, y: yy, size, font, color: o.color ?? INK });
  };
  const newPage = () => { page = pdf.addPage([W, H]); page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: brand }); y = H - M - 10; };

  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: brand });
  y -= 10;

  // Header: logo / business name (left), invoice label (right)
  let leftBottom = y;
  if (logo) {
    const scale = Math.min(140 / logo.width, 52 / logo.height, 1);
    page.drawImage(logo, { x: M, y: y - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
    leftBottom = y - logo.height * scale;
  } else {
    text(d.business.name, M, y - 16, { font: bold, size: 18 });
    leftBottom = y - 22;
  }
  let by = leftBottom - 14;
  const bizLines = [logo ? d.business.name : null, ...wrap(d.business.address ?? "", regular, 9, 240), d.business.email, d.business.phone, d.business.website, d.business.taxId ? `Tax ID: ${d.business.taxId}` : null].filter(Boolean) as string[];
  bizLines.forEach((l, i) => { text(l, M, by, { size: 9, color: i === 0 && logo ? INK : MUTED, font: i === 0 && logo ? bold : regular }); by -= 12; });

  text("INVOICE", W - M, y - 16, { font: bold, size: 22, color: brand, right: true });
  text(d.invoice.number, W - M, y - 34, { font: mono, size: 11, right: true });
  const statusLabel = d.invoice.status.replace("_", " ").toUpperCase();
  text(statusLabel, W - M, y - 50, { font: bold, size: 8, color: MUTED, right: true });

  y = Math.min(by, y - 60) - 18;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
  y -= 22;

  // Billed to / dates
  text("BILLED TO", M, y, { font: bold, size: 8, color: MUTED });
  text("DETAILS", W - M - 190, y, { font: bold, size: 8, color: MUTED });
  let cy = y - 15;
  const clientLines = [d.client.name, d.client.businessName, ...wrap(d.client.address ?? "", regular, 9, 250), d.client.email, d.client.taxId ? `Tax ID: ${d.client.taxId}` : null].filter(Boolean) as string[];
  clientLines.forEach((l, i) => { text(l, M, cy, { font: i === 0 ? bold : regular, size: i === 0 ? 11 : 9, color: i === 0 ? INK : MUTED }); cy -= i === 0 ? 15 : 12; });
  const kv = [["Issue date", formatDate(d.invoice.issueDate)], ["Due date", formatDate(d.invoice.dueDate)], ["Currency", cur]];
  let ky = y - 15;
  kv.forEach(([k, v]) => { text(k, W - M - 190, ky, { size: 9, color: MUTED }); text(v, W - M, ky, { size: 9, font: bold, right: true }); ky -= 14; });
  y = Math.min(cy, ky) - 14;

  if (d.invoice.title) {
    text(d.invoice.title, M, y, { font: bold, size: 12 });
    y -= 22;
  }

  // Items table
  const colQty = W - M - 220, colPrice = W - M - 110, colAmt = W - M;
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.961, 0.957, 0.937) });
    text("DESCRIPTION", M + 8, y, { font: bold, size: 8, color: MUTED });
    text("QTY", colQty, y, { font: bold, size: 8, color: MUTED, right: true });
    text("UNIT PRICE", colPrice, y, { font: bold, size: 8, color: MUTED, right: true });
    text("AMOUNT", colAmt - 8, y, { font: bold, size: 8, color: MUTED, right: true });
    y -= 24;
  };
  header();
  for (const it of d.invoice.items) {
    const lines = wrap(it.description, regular, 9.5, colQty - M - 60);
    const h = lines.length * 12 + 10;
    if (y - h < 150) { newPage(); header(); }
    lines.forEach((l, i) => text(l, M + 8, y - i * 12, { size: 9.5 }));
    text(String(Number(it.quantity)), colQty, y, { size: 9.5, right: true });
    text(pdfMoney(it.unitPrice, cur), colPrice, y, { size: 9.5, right: true });
    text(pdfMoney(it.lineTotal, cur), colAmt - 8, y, { size: 9.5, right: true });
    y -= h;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: LINE });
  }

  // Totals
  if (y < 230) { newPage(); }
  y -= 8;
  const tx = W - M - 220;
  const row = (label: string, value: string, o: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    text(label, tx, y, { size: 9.5, color: o.color ?? MUTED, font: o.bold ? bold : regular });
    text(value, colAmt - 8, y, { size: 9.5, font: o.bold ? bold : regular, right: true, color: o.color });
    y -= 16;
  };
  row("Subtotal", pdfMoney(d.invoice.subtotal, cur));
  if (Number(d.invoice.discountTotal) > 0) row(d.invoice.discountLabel, `- ${pdfMoney(d.invoice.discountTotal, cur)}`);
  if (Number(d.invoice.taxTotal) > 0 || Number(d.invoice.taxRate) > 0) row(`Tax (${Number(d.invoice.taxRate)}%)`, pdfMoney(d.invoice.taxTotal, cur));
  page.drawLine({ start: { x: tx, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.6, color: LINE });
  y -= 2;
  row("Total", pdfMoney(d.invoice.total, cur), { bold: true, color: INK });
  if (Number(d.invoice.paid) > 0) row("Payments received", `- ${pdfMoney(d.invoice.paid, cur)}`);
  y -= 2;
  page.drawRectangle({ x: tx - 8, y: y - 9, width: W - M - tx + 8, height: 28, color: brand });
  text("Balance due", tx, y, { font: bold, size: 11, color: rgb(1, 1, 1) });
  text(pdfMoney(d.invoice.balance, cur), colAmt - 8, y, { font: bold, size: 11, color: rgb(1, 1, 1), right: true });
  y -= 40;

  // Payments
  const pays = d.payments;
  if (pays.length) {
    if (y < 200) newPage();
    text("PAYMENT HISTORY", M, y, { font: bold, size: 8, color: MUTED });
    y -= 14;
    for (const p of pays) {
      if (y < 110) newPage();
      text(formatDate(p.date), M, y, { size: 9 });
      text(p.kind === "reversal" ? "Reversal" : p.method.replace(/_/g, " "), M + 90, y, { size: 9, color: MUTED });
      text(pdfMoney(p.amount, cur), M + 330, y, { size: 9, right: true });
      y -= 13;
    }
    y -= 10;
  }

  const blocks: [string, string | null][] = [["PAYMENT INSTRUCTIONS", d.business.paymentInstructions], ["PAYMENT TERMS", d.invoice.paymentTerms], ["NOTES", d.invoice.notes]];
  for (const [label, body] of blocks) {
    if (!body) continue;
    const lines = wrap(body, regular, 9, W - 2 * M);
    if (y - lines.length * 12 - 20 < 70) newPage();
    text(label, M, y, { font: bold, size: 8, color: MUTED });
    y -= 13;
    lines.forEach((l) => { text(l, M, y, { size: 9 }); y -= 12; });
    y -= 10;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.4, color: LINE });
    p.drawText(pdfSafe(d.business.footer || d.business.name).slice(0, 110), { x: M, y: 30, size: 8, font: regular, color: MUTED });
    const label = `${d.invoice.number}  |  Page ${i + 1} of ${pages.length}`;
    p.drawText(pdfSafe(label), { x: W - M - regular.widthOfTextAtSize(pdfSafe(label), 8), y: 30, size: 8, font: regular, color: MUTED });
  });
  return pdf.save();
}

export interface ReportPdfInput {
  title: string;
  subtitle: string;
  businessName: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null>[];
  totals?: string[];
}

export async function renderReportPdf(r: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(r.title));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89, H = 595.28, M = 40;
  const colW = (W - 2 * M) / r.columns.length;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const draw = (t: string, x: number, yy: number, f: PDFFont, size: number, color = INK, right = false) => {
    const s = pdfSafe(t);
    page.drawText(s, { x: right ? x - f.widthOfTextAtSize(s, size) : x, y: yy, size, font: f, color });
  };
  const fit = (t: string, f: PDFFont, size: number, w: number) => {
    let s = pdfSafe(t);
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > w) s = s.slice(0, -2);
    return s === pdfSafe(t) ? s : s.trimEnd() + ".";
  };
  const head = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.961, 0.957, 0.937) });
    r.columns.forEach((c, i) => {
      const x = M + i * colW;
      if (c.align === "right") draw(c.label.toUpperCase(), x + colW - 6, y, bold, 7.5, MUTED, true);
      else draw(c.label.toUpperCase(), x + 6, y, bold, 7.5, MUTED);
    });
    y -= 22;
  };
  draw(r.businessName, M, y, bold, 9, MUTED);
  y -= 22;
  draw(r.title, M, y, bold, 18);
  y -= 16;
  draw(r.subtitle, M, y, regular, 9, MUTED);
  y -= 26;
  head();
  for (const row of r.rows) {
    if (y < 60) { page = pdf.addPage([W, H]); y = H - M; head(); }
    r.columns.forEach((c, i) => {
      const x = M + i * colW;
      const v = String(row[c.key] ?? "");
      if (c.align === "right") draw(fit(v, regular, 8.5, colW - 12), x + colW - 6, y, regular, 8.5, INK, true);
      else draw(fit(v, regular, 8.5, colW - 12), x + 6, y, regular, 8.5);
    });
    y -= 15;
    page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.3, color: LINE });
  }
  if (r.rows.length === 0) draw("No records match these filters.", M + 6, y, regular, 9, MUTED);
  if (r.totals?.length) {
    y -= 12;
    if (y < 60) { page = pdf.addPage([W, H]); y = H - M; }
    draw("Totals (per currency, never combined)", M, y, bold, 8, MUTED);
    r.totals.forEach((t) => { y -= 13; draw(t, M, y, bold, 9); });
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`Generated by DuePing  |  Page ${i + 1} of ${pages.length}`, { x: M, y: 20, size: 7.5, font: regular, color: MUTED }));
  return pdf.save();
}
