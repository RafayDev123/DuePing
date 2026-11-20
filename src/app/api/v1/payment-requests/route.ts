import { route } from "@/lib/api";
import { listVerificationRequests } from "@/services/payments";

export const GET = route({}, async ({ ctx, req }) => listVerificationRequests(ctx.ws.id, new URL(req.url).searchParams.get("status") || undefined));
