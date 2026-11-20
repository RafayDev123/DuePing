import { z } from "zod";
import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exportReport } from "@/lib/export";
import { REPORT_TYPES, runReport } from "@/services/reports";
import { getSettings } from "@/services/workspace";

const q = z.object({
  type: z.enum(REPORT_TYPES),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  from: z.string().optional(), to: z.string().optional(), currency: z.string().length(3).optional(), clientId: z.string().uuid().optional(), status: z.string().max(20).optional(),
});

export const GET = route({ query: q, limit: { max: 20, windowSec: 300 } }, async ({ ctx, query }) => {
  const s = await getSettings(ctx.ws.id);
  const r = await runReport(ctx.ws.id, s.timezone, query.type, query);
  await audit(ctx.ws.id, ctx.user.id, "report.exported", "report", query.type, { format: query.format });
  const subtitle = [query.from && `From ${query.from}`, query.to && `to ${query.to}`, query.currency && `Currency ${query.currency}`].filter(Boolean).join(" · ") || "All records";
  return exportReport(r, query.format, { businessName: s.businessName, subtitle });
});
