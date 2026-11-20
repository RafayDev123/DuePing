import { z } from "zod";
import { route } from "@/lib/api";
import { dashboardOverview } from "@/services/dashboard";
import { getSettings } from "@/services/workspace";

const q = z.object({
  range: z.string().max(20).optional(), from: z.string().optional(), to: z.string().optional(), currency: z.string().length(3).optional(),
  clientId: z.string().uuid().optional(), status: z.string().max(20).optional(),
});

export const GET = route({ query: q }, async ({ ctx, query }) => dashboardOverview(ctx.ws.id, (await getSettings(ctx.ws.id)).timezone, query));
