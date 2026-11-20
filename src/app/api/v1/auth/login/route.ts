import { publicRoute } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { loginInput } from "@/lib/validation";
import { login } from "@/services/account";

export const POST = publicRoute({ body: loginInput, limit: { max: 10, windowSec: 300 } }, async ({ body }) => {
  const userId = await login(body.email, body.password);
  await createSession(userId);
  return { ok: true };
});
