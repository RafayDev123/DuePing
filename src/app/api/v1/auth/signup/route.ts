import { publicRoute } from "@/lib/api";
import { getBaseUrl } from "@/lib/env";
import { signupInput } from "@/lib/validation";
import { signup } from "@/services/account";
import { createSession } from "@/lib/auth";

export const POST = publicRoute({ body: signupInput, limit: { max: 8, windowSec: 3600 } }, async ({ body }) => {
  const r = await signup(body, await getBaseUrl());
  if (!r.needsVerification) await createSession(r.userId);
  return { needsVerification: r.needsVerification, verifyUrl: r.verifyUrl };
});
