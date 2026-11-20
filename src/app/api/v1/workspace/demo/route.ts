import { route } from "@/lib/api";
import { loadDemoData, removeDemoData } from "@/services/demo";

export const POST = route({ perm: "invoices.write" }, async ({ ctx }) => {
  await loadDemoData(ctx.ws.id, ctx.user.id);
  return { loaded: true };
});

export const DELETE = route({ perm: "settings.manage" }, async ({ ctx }) => {
  await removeDemoData(ctx.ws.id, ctx.user.id);
  return { removed: true };
});
