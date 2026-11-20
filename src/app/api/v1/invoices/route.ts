import { z } from "zod";
import { route } from "@/lib/api";
import { invoiceInput } from "@/lib/validation";
import { createInvoice, listInvoices } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

const query = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "void"]).optional(),
  clientId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.string().max(20).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  archived: z.enum(["1", "true", "0", "false"]).optional(),
});

export const GET = route({ query }, async ({ ctx, query }) => {
  const s = await getSettings(ctx.ws.id);
  return listInvoices(ctx.ws.id, s.timezone, { ...query, archived: query.archived === "1" || query.archived === "true" });
});

export const POST = route({ perm: "invoices.write", body: invoiceInput }, async ({ ctx, body }) => {
  const r = await createInvoice(ctx.ws.id, ctx.user.id, body);
  return Response.json({ ok: true, data: r }, { status: 201 });
});
