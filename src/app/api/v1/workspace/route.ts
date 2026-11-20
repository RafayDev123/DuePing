import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { deleteWorkspace } from "@/services/workspace";

export const DELETE = route({ perm: "workspace.delete", body: z.object({ confirmName: z.string() }), limit: { max: 3, windowSec: 600 } }, async ({ ctx, body }) => {
  if (body.confirmName !== ctx.ws.name) throw new ApiError(422, "validation_failed", "Type the exact workspace name to confirm deletion");
  await deleteWorkspace(ctx.ws.id, ctx.user.id);
  return { deleted: true };
});
