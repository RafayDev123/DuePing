import { ApiError, route } from "@/lib/api";
import { checkUpload } from "@/lib/files";
import { importRow } from "@/lib/validation";
import { one, sql } from "@/lib/sql";
import { importRows } from "@/services/imports";

/** Step 2: the user reviewed and corrected the extracted fields; only now is anything saved. */
export const POST = route({ perm: "import.run", limit: { max: 20, windowSec: 600 } }, async ({ ctx, req }) => {
  const form = await req.formData().catch(() => null);
  const f = await checkUpload(form?.get("file") as File | null, ["application/pdf"], 8 * 1024 * 1024);
  let fields: unknown;
  try {
    fields = JSON.parse(String(form?.get("fields") ?? "{}"));
  } catch {
    throw new ApiError(400, "invalid_json", "Fields must be valid JSON");
  }
  const parsed = importRow.safeParse(fields);
  if (!parsed.success) throw new ApiError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid fields", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  if (await one(sql`select 1 from invoices where workspace_id = ${ctx.ws.id} and number = ${parsed.data.number}`)) {
    throw new ApiError(409, "duplicate_number", `Invoice number ${parsed.data.number} already exists`);
  }
  const summary = await importRows(ctx.ws.id, ctx.user.id, [parsed.data], "pdf");
  if (summary.created !== 1) throw new ApiError(422, "import_failed", summary.errors[0]?.error ?? "Import failed");
  const inv = await one<{ id: string }>(sql`select id from invoices where workspace_id = ${ctx.ws.id} and number = ${parsed.data.number}`);
  await one(sql`insert into files (workspace_id, invoice_id, kind, filename, mime, size, sha256, data, uploaded_by)
    values (${ctx.ws.id}, ${inv!.id}, 'invoice_attachment', ${f.filename}, ${f.mime}, ${f.buffer.length}, ${f.sha256}, ${f.buffer}, ${ctx.user.id}) returning id`);
  return { id: inv!.id };
});
