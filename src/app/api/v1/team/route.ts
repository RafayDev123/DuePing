import { z } from "zod";
import { route } from "@/lib/api";
import { getBaseUrl } from "@/lib/env";
import { ROLES } from "@/lib/permissions";
import { invite, listTeam } from "@/services/team";

export const GET = route({}, async ({ ctx }) => listTeam(ctx.ws.id));

export const POST = route(
  { perm: "team.manage", body: z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ROLES) }) },
  async ({ ctx, body }) => invite(ctx.ws.id, ctx.user.id, ctx.role, body.email, body.role, await getBaseUrl()),
);
