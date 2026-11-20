import { route } from "@/lib/api";
import { reverseInput } from "@/lib/validation";
import { reversePayment } from "@/services/payments";
import { getSettings } from "@/services/workspace";

export const POST = route({ perm: "payments.write", body: reverseInput }, async ({ ctx, params, body }) => {
  const s = await getSettings(ctx.ws.id);
  return reversePayment(ctx.ws.id, ctx.user.id, params.id, body.reason, s.timezone);
});
