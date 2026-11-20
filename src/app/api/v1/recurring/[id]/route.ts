import { z } from "zod";
import { route } from "@/lib/api";
import { deleteRecurring, setRecurringActive } from "@/services/recurring";

export const PATCH = route({ perm: "invoices.write", body: z.object({ active: z.boolean() }) }, async ({ ctx, params, body }) => {
  await setRecurringActive(ctx.ws.id, ctx.user.id, params.id, body.active);
  return { ok: true };
});

export const DELETE = route({ perm: "invoices.write" }, async ({ ctx, params }) => {
  await deleteRecurring(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
