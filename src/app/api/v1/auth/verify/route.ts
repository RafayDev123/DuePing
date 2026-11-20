import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { verifyEmail } from "@/services/account";

export const POST = publicRoute({ body: z.object({ token: z.string().min(20).max(100) }), limit: { max: 20, windowSec: 900 } }, async ({ body }) => {
  const userId = await verifyEmail(body.token);
  await createSession(userId);
  return { ok: true };
});
