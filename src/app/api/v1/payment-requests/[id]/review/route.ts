import { z } from "zod";
import { route } from "@/lib/api";
import { positiveDecimal, ymd } from "@/lib/validation";
import { reviewRequest } from "@/services/payments";

export const POST = route(
  {
    perm: "payments.write",
    body: z.object({
      action: z.enum(["under_review", "approve", "reject"]),
      amount: positiveDecimal.optional(),
      method: z.string().max(60).optional(),
      paidAt: ymd.optional(),
      reference: z.string().max(120).optional().nullable(),
      note: z.string().max(500).optional().nullable(),
    }),
  },
  async ({ ctx, params, body }) => reviewRequest(ctx.ws.id, ctx.user.id, params.id, body.action, body),
);
