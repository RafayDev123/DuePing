import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { resetPassword } from "@/services/account";

export const POST = publicRoute(
  { body: z.object({ token: z.string().min(20).max(100), password: z.string().min(10, "Use at least 10 characters").max(200) }), limit: { max: 10, windowSec: 900 } },
  async ({ body }) => {
    await resetPassword(body.token, body.password);
    return { ok: true };
  },
);
