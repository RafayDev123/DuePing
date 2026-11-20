import { z } from "zod";
import { route } from "@/lib/api";
import { getTemplates, resetTemplate, saveTemplate } from "@/services/reminders";

export const GET = route({}, async ({ ctx }) => getTemplates(ctx.ws.id));

export const PUT = route(
  { perm: "reminders.manage", body: z.object({ key: z.string(), language: z.string(), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(10).max(4000) }) },
  async ({ ctx, body }) => {
    await saveTemplate(ctx.ws.id, ctx.user.id, body.key, body.language, body.subject, body.body);
    return { ok: true };
  },
);

export const DELETE = route({ perm: "reminders.manage", body: z.object({ key: z.string(), language: z.string() }) }, async ({ ctx, body }) => {
  await resetTemplate(ctx.ws.id, ctx.user.id, body.key, body.language);
  return { ok: true };
});
