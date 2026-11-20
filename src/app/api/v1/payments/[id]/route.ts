import { route } from "@/lib/api";
import { getPayment } from "@/services/payments";

export const GET = route({}, async ({ ctx, params }) => getPayment(ctx.ws.id, params.id));
