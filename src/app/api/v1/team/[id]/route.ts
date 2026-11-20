import { z } from "zod";
import { route } from "@/lib/api";
import { ROLES } from "@/lib/permissions";
import { changeRole, removeMember } from "@/services/team";

export const PATCH = route({ perm: "team.manage", body: z.object({ role: z.enum(ROLES) }) }, async ({ ctx, body, params }) => {
  await changeRole(ctx.ws.id, ctx.user.id, ctx.role, params.id, body.role);
  return { ok: true };
});

export const DELETE = route({ perm: "team.manage" }, async ({ ctx, params }) => {
  await removeMember(ctx.ws.id, ctx.user.id, ctx.role, params.id);
  return { ok: true };
});
