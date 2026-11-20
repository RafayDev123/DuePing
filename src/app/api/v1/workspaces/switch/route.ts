import { z } from "zod";
import { ApiError, publicRoute } from "@/lib/api";
import { getUser, setWorkspaceCookie } from "@/lib/auth";
import { one, sql } from "@/lib/sql";

export const POST = publicRoute({ body: z.object({ id: z.string().uuid() }) }, async ({ body }) => {
  const user = await getUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Authentication required");
  const m = await one(sql`select 1 from workspace_members where workspace_id = ${body.id} and user_id = ${user.id}`);
  if (!m) throw new ApiError(404, "not_found", "Workspace not found");
  await setWorkspaceCookie(body.id);
  return { id: body.id };
});
