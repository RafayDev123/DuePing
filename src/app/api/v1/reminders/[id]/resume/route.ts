import { route } from "@/lib/api";
import { resumeSchedule } from "@/services/reminders";

export const POST = route({ perm: "reminders.manage" }, async ({ ctx, params }) => {
  await resumeSchedule(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
