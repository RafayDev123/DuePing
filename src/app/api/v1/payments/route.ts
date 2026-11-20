import { z } from "zod";
import { route } from "@/lib/api";
import { paymentInput } from "@/lib/validation";
import { listPayments, recordPayment } from "@/services/payments";

const query = z.object({
  q: z.string().max(100).optional(), method: z.string().max(40).optional(), currency: z.string().length(3).optional(), clientId: z.string().uuid().optional(),
  from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

export const GET = route({ query }, async ({ ctx, query }) => listPayments(ctx.ws.id, query));

export const POST = route({ perm: "payments.write", body: paymentInput, limit: { max: 60, windowSec: 60 } }, async ({ ctx, body }) => {
  const r = await recordPayment(ctx.ws.id, ctx.user.id, body);
  return Response.json({ ok: true, data: r }, { status: 201 });
});
