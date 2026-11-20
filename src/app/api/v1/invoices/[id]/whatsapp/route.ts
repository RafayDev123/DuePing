import { z } from "zod";
import { route } from "@/lib/api";
import { whatsappPrepare } from "@/services/integrations";

export const POST = route(
  { perm: "invoices.write", body: z.object({ templateKey: z.enum(["upcoming", "due_today", "first_overdue", "follow_up", "final", "payment_confirmation"]).default("follow_up") }), limit: { max: 40, windowSec: 600 } },
  async ({ ctx, params, body }) => whatsappPrepare(ctx.ws.id, ctx.user.id, params.id, body.templateKey),
);
