import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exportWorkspace } from "@/services/workspace";

export const GET = route({ perm: "settings.manage", limit: { max: 5, windowSec: 600 } }, async ({ ctx }) => {
  const data = await exportWorkspace(ctx.ws.id);
  await audit(ctx.ws.id, ctx.user.id, "workspace.exported", "workspace", ctx.ws.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="dueping-export-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "no-store" },
  });
});
