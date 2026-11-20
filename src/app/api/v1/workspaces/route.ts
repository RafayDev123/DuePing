import { z } from "zod";
import { ApiError, publicRoute } from "@/lib/api";
import { getUser, setWorkspaceCookie } from "@/lib/auth";
import { createWorkspace } from "@/services/workspace";

export const POST = publicRoute({ body: z.object({ name: z.string().trim().min(1).max(160), timezone: z.string().max(60).optional() }) }, async ({ body }) => {
  const user = await getUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Authentication required");
  const id = await createWorkspace(user.id, body.name, body.timezone);
  await setWorkspaceCookie(id);
  return { id };
});
