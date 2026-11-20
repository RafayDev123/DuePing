import { z } from "zod";
import { route } from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import { CSV_FIELDS, importRows, suggestMapping, validateCsv, type Mapping } from "@/services/imports";

const body = z.object({
  csv: z.string().min(5).max(2_000_000),
  mode: z.enum(["preview", "validate", "commit"]),
  mapping: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
  dateFormat: z.enum(["iso", "dmy", "mdy"]).default("iso"),
});

export const POST = route({ perm: "import.run", body, limit: { max: 30, windowSec: 600 } }, async ({ ctx, body }) => {
  if (body.mode === "preview") {
    const parsed = parseCsv(body.csv);
    const [headers = [], ...rest] = parsed;
    return { headers, sample: rest.slice(0, 8), rowCount: rest.length, suggested: suggestMapping(headers), fields: CSV_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required })) };
  }
  const mapping = (body.mapping ?? {}) as Mapping;
  const v = await validateCsv(ctx.ws.id, body.csv, mapping, body.dateFormat);
  const counts = { valid: 0, invalid: 0, duplicate: 0 };
  v.results.forEach((r) => counts[r.status]++);
  if (body.mode === "validate") return { counts, results: v.results.map((r) => ({ line: r.line, status: r.status, errors: r.errors, raw: r.raw })), headers: v.headers };
  // commit: only rows that pass *server-side* validation are imported
  const valid = v.results.filter((r) => r.status === "valid" && r.data).map((r) => r.data!);
  const summary = await importRows(ctx.ws.id, ctx.user.id, valid, "csv");
  return { ...summary, skippedInvalid: counts.invalid, skippedDuplicates: counts.duplicate };
});
