import { ApiError, route } from "@/lib/api";
import { clientInput } from "@/lib/validation";
import { archiveClient, clientHistory, getClient, listNotes, updateClient } from "@/services/clients";

export const GET = route({}, async ({ ctx, params }) => {
  const client = await getClient(ctx.ws.id, params.id);
  return { client, ...(await clientHistory(ctx.ws.id, params.id)), notes: await listNotes(ctx.ws.id, params.id) };
});

export const PATCH = route({ perm: "clients.write" }, async ({ ctx, params, req }) => {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
  const parsed = clientInput.partial().safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid input", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  // Zod applies defaults/transforms to absent keys; only apply the keys the caller actually sent.
  const present = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in raw));
  return updateClient(ctx.ws.id, ctx.user.id, params.id, present);
});

export const DELETE = route({ perm: "clients.write" }, async ({ ctx, params }) => {
  await archiveClient(ctx.ws.id, ctx.user.id, params.id, true);
  return { archived: true };
});
