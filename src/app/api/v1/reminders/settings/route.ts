import { z } from "zod";
import { route } from "@/lib/api";
import { confirmChecklistItem, getChecklist, setAutoReminders } from "@/services/reminders";

export const GET = route({}, async ({ ctx }) => getChecklist(ctx.ws.id));

export const POST = route(
  { perm: "reminders.manage", body: z.object({ action: z.enum(["confirm_templates", "confirm_preferences", "enable", "disable"]) }) },
  async ({ ctx, body }) => {
    if (body.action === "confirm_templates") await confirmChecklistItem(ctx.ws.id, ctx.user.id, "templates");
    else if (body.action === "confirm_preferences") await confirmChecklistItem(ctx.ws.id, ctx.user.id, "preferences");
    else await setAutoReminders(ctx.ws.id, ctx.user.id, body.action === "enable");
    return getChecklist(ctx.ws.id);
  },
);
