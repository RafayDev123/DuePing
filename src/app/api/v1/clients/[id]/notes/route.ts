import { z } from "zod";
import { route } from "@/lib/api";
import { addNote } from "@/services/clients";

export const POST = route({ perm: "clients.write", body: z.object({ body: z.string().trim().min(1).max(2000) }) }, async ({ ctx, params, body }) => {
  await addNote(ctx.ws.id, ctx.user.id, params.id, body.body);
  return { ok: true };
});
