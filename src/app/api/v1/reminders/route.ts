import { z } from "zod";
import { route } from "@/lib/api";
import { listRules, listSchedules } from "@/services/reminders";

export const GET = route({ query: z.object({ group: z.enum(["upcoming", "sent", "failed", "all"]).default("upcoming"), invoiceId: z.string().uuid().optional() }) }, async ({ ctx, query }) => ({
  schedules: await listSchedules(ctx.ws.id, query.group, query.invoiceId),
  rules: await listRules(ctx.ws.id),
}));
