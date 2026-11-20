import { ApiError, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, sql } from "@/lib/sql";

/** Authenticated, workspace-scoped file download. Always an attachment, never rendered inline from our origin. */
export const GET = route({ limit: { max: 60, windowSec: 60 } }, async ({ ctx, params }) => {
  const f = await one<{ filename: string; mime: string; data: Buffer; kind: string }>(sql`select filename, mime, data, kind from files where id = ${params.id} and workspace_id = ${ctx.ws.id}`);
  if (!f) throw new ApiError(404, "not_found", "File not found");
  await audit(ctx.ws.id, ctx.user.id, "file.downloaded", "file", params.id, { kind: f.kind });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "content-type": f.mime,
      "content-disposition": `attachment; filename="${f.filename.replace(/[^\w.\- ()]/g, "_")}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "private, no-store",
    },
  });
});
