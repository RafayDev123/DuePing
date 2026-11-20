import { route } from "@/lib/api";
import { testEmailIntegration } from "@/services/integrations";

export const POST = route({ perm: "settings.manage", limit: { max: 6, windowSec: 600 } }, async ({ ctx }) => testEmailIntegration(ctx.ws.id, ctx.user.id, ctx.user.email));
