import ExcelJS from "exceljs";
import { toCsv, safeCell } from "@/lib/csv";
import { renderReportPdf } from "@/lib/pdf";
import { formatCell, type ReportResult } from "@/services/reports";

export async function exportReport(r: ReportResult, format: "csv" | "xlsx" | "pdf", meta: { businessName: string; subtitle: string }): Promise<Response> {
  const base = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  if (format === "csv") {
    return new Response(toCsv(r.columns, r.rows), { headers: { ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` } });
  }
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "DuePing";
    const ws = wb.addWorksheet(r.title.slice(0, 30));
    ws.columns = r.columns.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4), style: c.type === "money" ? { numFmt: "#,##0.00" } : {} }));
    ws.getRow(1).font = { bold: true };
    for (const row of r.rows) {
      const out: Record<string, string | number> = {};
      for (const c of r.columns) {
        const v = row[c.key];
        out[c.key] = c.type === "money" || c.type === "int" ? Number(v ?? 0) : safeCell(v);
      }
      ws.addRow(out);
    }
    if (r.totals.length) {
      ws.addRow({});
      r.totals.forEach((t) => ws.addRow({ [r.columns[0].key]: `${t.label} (${t.currency})`, [r.columns[r.columns.length - 2].key]: Number(t.amount) }));
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Response(Buffer.from(buf as ArrayBuffer), { headers: { ...headers, "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${base}.xlsx"` } });
  }
  const bytes = await renderReportPdf({
    title: r.title, subtitle: meta.subtitle, businessName: meta.businessName,
    columns: r.columns.map((c) => ({ key: c.key, label: c.label, align: c.align })),
    rows: r.rows.map((row) => Object.fromEntries(r.columns.map((c) => [c.key, formatCell(c, row)]))),
    totals: r.totals.map((t) => `${t.label} ${t.currency}: ${t.amount}`),
  });
  return new Response(Buffer.from(bytes), { headers: { ...headers, "content-type": "application/pdf", "content-disposition": `attachment; filename="${base}.pdf"` } });
}
