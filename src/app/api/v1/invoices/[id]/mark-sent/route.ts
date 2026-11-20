import { route } from "@/lib/api";
import { markSent } from "@/services/invoices";

export const POST = route({ perm: "invoices.write" }, async ({ ctx, params }) => {
  await markSent(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
