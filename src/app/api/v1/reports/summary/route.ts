import { z } from "zod";
import { route } from "@/lib/api";
import { runReport } from "@/services/reports";
import { getSettings } from "@/services/workspace";

const q = z.object({ from: z.string().optional(), to: z.string().optional(), currency: z.string().length(3).optional(), clientId: z.string().uuid().optional() });

export const GET = route({ query: q }, async ({ ctx, query }) => {
  const s = await getSettings(ctx.ws.id);
  const [aging, monthly, clients] = await Promise.all([runReport(ctx.ws.id, s.timezone, "aging", query), runReport(ctx.ws.id, s.timezone, "monthly_collections", query), runReport(ctx.ws.id, s.timezone, "client_balances", query)]);
  return { aging: aging.rows, monthlyCollections: monthly.rows, clientBalances: clients.rows };
});
