import { route } from "@/lib/api";
import { ruleInput } from "@/lib/validation";
import { deleteRule, updateRule } from "@/services/reminders";

export const PATCH = route({ perm: "reminders.manage", body: ruleInput.partial().extend({ enabled: ruleInput.shape.enabled.optional() }) }, async ({ ctx, params, body }) => {
  await updateRule(ctx.ws.id, ctx.user.id, params.id, body);
  return { ok: true };
});

export const DELETE = route({ perm: "reminders.manage" }, async ({ ctx, params }) => {
  await deleteRule(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
