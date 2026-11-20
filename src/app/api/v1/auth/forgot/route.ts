import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getBaseUrl } from "@/lib/env";
import { forgotPassword } from "@/services/account";

export const POST = publicRoute(
  { body: z.object({ email: z.string().trim().toLowerCase().email() }), limit: { max: 5, windowSec: 900 } },
  async ({ body }) => {
    const r = await forgotPassword(body.email, await getBaseUrl());
    return { message: "If an account exists for that email, a reset link has been sent.", devUrl: r.devUrl };
  },
);
