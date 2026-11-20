import { z } from "zod";
import { route } from "@/lib/api";
import { clientInput } from "@/lib/validation";
import { createClient, listClients } from "@/services/clients";

export const GET = route(
  { query: z.object({ q: z.string().max(100).optional(), filter: z.string().max(20).optional(), page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }) },
  async ({ ctx, query }) => listClients(ctx.ws.id, query),
);

export const POST = route({ perm: "clients.write", body: clientInput }, async ({ ctx, body }) => {
  const c = await createClient(ctx.ws.id, ctx.user.id, body);
  return Response.json({ ok: true, data: c }, { status: 201 });
});
