import { z } from "zod";
import { ApiError, publicRoute } from "@/lib/api";
import { getUser, setWorkspaceCookie } from "@/lib/auth";
import { acceptInvite } from "@/services/team";

export const POST = publicRoute({ body: z.object({ token: z.string().min(20).max(100) }), limit: { max: 20, windowSec: 600 } }, async ({ body }) => {
  const user = await getUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Sign in or create an account first");
  const wsId = await acceptInvite(body.token, user.id, user.email);
  await setWorkspaceCookie(wsId);
  return { workspaceId: wsId };
});
