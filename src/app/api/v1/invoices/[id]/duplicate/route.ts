import { route } from "@/lib/api";
import { duplicateInvoice } from "@/services/invoices";

export const POST = route({ perm: "invoices.write" }, async ({ ctx, params }) => duplicateInvoice(ctx.ws.id, ctx.user.id, params.id));
