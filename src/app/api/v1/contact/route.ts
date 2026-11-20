import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { rows, sql } from "@/lib/sql";

export const POST = publicRoute(
  { body: z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), message: z.string().trim().min(10, "Please write at least a sentence").max(3000), website: z.string().max(0).optional() }), limit: { max: 5, windowSec: 3600 } },
  async ({ body }) => {
    await rows(sql`insert into contact_messages (name, email, message) values (${body.name}, ${body.email}, ${body.message})`);
    return { received: true };
  },
);
