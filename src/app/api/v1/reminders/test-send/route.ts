import { z } from "zod";
import { route } from "@/lib/api";
import { testSendTemplate } from "@/services/integrations";

export const POST = route(
  { perm: "reminders.manage", body: z.object({ key: z.string(), language: z.string() }), limit: { max: 10, windowSec: 600 } },
  async ({ ctx, body }) => testSendTemplate(ctx.ws.id, ctx.user.id, ctx.user.email, body.key, body.language),
);
