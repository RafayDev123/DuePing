import { z } from "zod";
import { route } from "@/lib/api";
import { getEmailIntegration, removeEmailIntegration, saveEmailIntegration } from "@/services/integrations";

export const GET = route({ perm: "settings.manage" }, async ({ ctx }) => getEmailIntegration(ctx.ws.id));

export const PUT = route(
  {
    perm: "settings.manage",
    body: z.object({
      apiKey: z.string().trim().min(8).max(300).optional().nullable(),
      fromEmail: z.string().trim().toLowerCase().email(),
      fromName: z.string().trim().max(100).optional().nullable(),
      replyTo: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("").transform(() => null)),
    }),
    limit: { max: 20, windowSec: 600 },
  },
  async ({ ctx, body }) => {
    await saveEmailIntegration(ctx.ws.id, ctx.user.id, body);
    return { ok: true };
  },
);

export const DELETE = route({ perm: "settings.manage" }, async ({ ctx }) => {
  await removeEmailIntegration(ctx.ws.id, ctx.user.id);
  return { ok: true };
});
