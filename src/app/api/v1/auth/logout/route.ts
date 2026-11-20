import { publicRoute } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const POST = publicRoute({}, async () => {
  await destroySession();
  return { ok: true };
});
