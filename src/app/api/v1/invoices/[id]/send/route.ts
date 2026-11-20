import { z } from "zod";
import { route } from "@/lib/api";
import { sendInvoiceEmail } from "@/services/integrations";

export const POST = route(
  { perm: "invoices.write", body: z.object({ to: z.string().trim().toLowerCase().email().optional().nullable(), message: z.string().max(1000).optional().nullable() }), limit: { max: 30, windowSec: 600 } },
  async ({ ctx, params, body }) => sendInvoiceEmail(ctx.ws.id, ctx.user.id, params.id, body),
);
