import { z } from "zod";
import { route } from "@/lib/api";
import { getBaseUrl } from "@/lib/env";
import { createPortalLink, revokePortalLinks } from "@/services/portal";

export const POST = route(
  { perm: "invoices.write", body: z.object({ ttlDays: z.number().int().min(1).max(365).default(60) }), limit: { max: 30, windowSec: 600 } },
  async ({ ctx, params, body }) => createPortalLink(ctx.ws.id, params.id, ctx.user.id, body.ttlDays, await getBaseUrl()),
);

export const DELETE = route({ perm: "invoices.write" }, async ({ ctx, params }) => revokePortalLinks(ctx.ws.id, ctx.user.id, params.id));
