import { z } from "zod";
import { route } from "@/lib/api";
import { closeInvoice } from "@/services/invoices";

export const POST = route(
  { perm: "invoices.write", body: z.object({ kind: z.enum(["void", "cancelled"]).default("void"), reason: z.string().trim().min(3, "Please give a reason").max(500) }) },
  async ({ ctx, params, body }) => {
    await closeInvoice(ctx.ws.id, ctx.user.id, params.id, body.kind, body.reason);
    return { ok: true };
  },
);
