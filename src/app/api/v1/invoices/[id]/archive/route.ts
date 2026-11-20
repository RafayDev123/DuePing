import { z } from "zod";
import { route } from "@/lib/api";
import { archiveInvoice } from "@/services/invoices";

export const POST = route({ perm: "invoices.write", body: z.object({ archived: z.boolean().default(true) }) }, async ({ ctx, params, body }) => {
  await archiveInvoice(ctx.ws.id, ctx.user.id, params.id, body.archived);
  return { ok: true };
});
