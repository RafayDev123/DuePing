import { route } from "@/lib/api";
import { pauseSchedule } from "@/services/reminders";

export const POST = route({ perm: "reminders.manage" }, async ({ ctx, params }) => {
  await pauseSchedule(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
