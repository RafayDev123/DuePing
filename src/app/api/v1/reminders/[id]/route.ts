import { z } from "zod";
import { route } from "@/lib/api";
import { rescheduleReminder } from "@/services/reminders";

export const PATCH = route({ perm: "reminders.manage", body: z.object({ scheduledAt: z.string().datetime() }) }, async ({ ctx, params, body }) => {
  await rescheduleReminder(ctx.ws.id, ctx.user.id, params.id, new Date(body.scheduledAt));
  return { ok: true };
});
