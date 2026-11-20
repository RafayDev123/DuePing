import { z } from "zod";
import { route } from "@/lib/api";
import { rows, sql } from "@/lib/sql";

export const GET = route({}, async ({ ctx }) =>
  rows(sql`select id, type, title, body, link, read_at, created_at from notifications where workspace_id = ${ctx.ws.id} order by created_at desc limit 100`),
);

export const POST = route({ body: z.object({ id: z.string().uuid().optional() }) }, async ({ ctx, body }) => {
  await rows(sql`update notifications set read_at = now() where workspace_id = ${ctx.ws.id} and read_at is null ${body.id ? sql`and id = ${body.id}` : sql``}`);
  return { ok: true };
});
