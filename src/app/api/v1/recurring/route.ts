import { z } from "zod";
import { route } from "@/lib/api";
import { ymd } from "@/lib/validation";
import { createRecurring, listRecurring } from "@/services/recurring";

export const GET = route({}, async ({ ctx }) => listRecurring(ctx.ws.id));

export const POST = route(
  {
    perm: "invoices.write",
    body: z.object({
      fromInvoiceId: z.string().uuid(),
      frequency: z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]),
      intervalDays: z.number().int().min(1).max(730).optional().nullable(),
      nextRunDate: ymd,
      endDate: ymd.optional().nullable(),
    }),
  },
  async ({ ctx, body }) => createRecurring(ctx.ws.id, ctx.user.id, body),
);
