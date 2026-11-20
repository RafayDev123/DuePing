import { z } from "zod";
import { route } from "@/lib/api";
import { invoiceInput, ymd } from "@/lib/validation";
import { changeDueDate, getInvoice, updateDraft } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export const GET = route({}, async ({ ctx, params }) => {
  const s = await getSettings(ctx.ws.id);
  return getInvoice(ctx.ws.id, params.id, s.timezone);
});

/** Full edit (drafts only) or `{ dueDate }` for open invoices (recalculates reminders). */
export const PATCH = route({ perm: "invoices.write", body: invoiceInput.or(z.object({ dueDate: ymd }).strict()) }, async ({ ctx, params, body }) => {
  if ("items" in body) return updateDraft(ctx.ws.id, ctx.user.id, params.id, body);
  await changeDueDate(ctx.ws.id, ctx.user.id, params.id, body.dueDate);
  return { id: params.id };
});
