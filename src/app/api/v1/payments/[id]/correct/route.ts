import { route } from "@/lib/api";
import { paymentInput } from "@/lib/validation";
import { correctPayment } from "@/services/payments";
import { getSettings } from "@/services/workspace";

/** Correction = reversal of the original entry + a new linked payment. Nothing is overwritten. */
export const POST = route({ perm: "payments.write", body: paymentInput.omit({ invoiceId: true, correctsPaymentId: true }) }, async ({ ctx, params, body }) => {
  const s = await getSettings(ctx.ws.id);
  return correctPayment(ctx.ws.id, ctx.user.id, params.id, body, s.timezone);
});
