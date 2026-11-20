import { route } from "@/lib/api";
import { retryReminder } from "@/services/reminders";

export const POST = route({ perm: "reminders.manage" }, async ({ ctx, params }) => {
  await retryReminder(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
