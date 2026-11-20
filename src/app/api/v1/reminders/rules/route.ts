import { route } from "@/lib/api";
import { ruleInput } from "@/lib/validation";
import { createRule, listRules } from "@/services/reminders";

export const GET = route({}, async ({ ctx }) => listRules(ctx.ws.id));

export const POST = route({ perm: "reminders.manage", body: ruleInput }, async ({ ctx, body }) => createRule(ctx.ws.id, ctx.user.id, body));
