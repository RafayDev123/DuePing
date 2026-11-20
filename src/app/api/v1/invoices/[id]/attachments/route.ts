import { ApiError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { checkUpload } from "@/lib/files";
import { one, sql } from "@/lib/sql";

export const POST = route({ perm: "invoices.write", limit: { max: 20, windowSec: 600 } }, async ({ ctx, params, req }) => {
  const inv = await one(sql`select 1 from invoices where id = ${params.id} and workspace_id = ${ctx.ws.id}`);
  if (!inv) throw new ApiError(404, "not_found", "Invoice not found");
  const form = await req.formData().catch(() => null);
  const file = checkUpload(form?.get("file") as File | null, ["application/pdf", "image/png", "image/jpeg"], 5 * 1024 * 1024);
  const f = await file;
  const row = await one<{ id: string }>(sql`insert into files (workspace_id, invoice_id, kind, filename, mime, size, sha256, data, uploaded_by)
    values (${ctx.ws.id}, ${params.id}, 'invoice_attachment', ${f.filename}, ${f.mime}, ${f.buffer.length}, ${f.sha256}, ${f.buffer}, ${ctx.user.id}) returning id`);
  await audit(ctx.ws.id, ctx.user.id, "invoice.attachment_added", "invoice", params.id, { filename: f.filename });
  return { id: row!.id };
});
