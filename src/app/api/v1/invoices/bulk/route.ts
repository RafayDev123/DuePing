import { z } from "zod";
import { route } from "@/lib/api";
import { archiveInvoice, markSent } from "@/services/invoices";

export const POST = route(
  { perm: "invoices.write", body: z.object({ action: z.enum(["mark_sent", "archive", "restore"]), ids: z.array(z.string().uuid()).min(1).max(200) }) },
  async ({ ctx, body }) => {
    const result = { done: 0, failed: [] as { id: string; error: string }[] };
    for (const id of body.ids) {
      try {
        if (body.action === "mark_sent") await markSent(ctx.ws.id, ctx.user.id, id);
        else await archiveInvoice(ctx.ws.id, ctx.user.id, id, body.action === "archive");
        result.done++;
      } catch (e) {
        result.failed.push({ id, error: e instanceof Error ? e.message : "failed" });
      }
    }
    return result;
  },
);
