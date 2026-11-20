import { route } from "@/lib/api";
import { revokeInvite } from "@/services/team";

export const DELETE = route({ perm: "team.manage" }, async ({ ctx, params }) => {
  await revokeInvite(ctx.ws.id, ctx.user.id, params.id);
  return { ok: true };
});
