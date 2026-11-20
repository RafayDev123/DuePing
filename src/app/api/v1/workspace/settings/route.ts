import { route } from "@/lib/api";
import { settingsInput } from "@/lib/validation";
import { getSettings, updateSettings } from "@/services/workspace";

export const GET = route({}, async ({ ctx }) => {
  const s = await getSettings(ctx.ws.id);
  return { ...s, logoDataUrl: s.logoDataUrl ? "[set]" : null };
});

export const PATCH = route({ perm: "settings.manage", body: settingsInput }, async ({ ctx, body }) => {
  await updateSettings(ctx.ws.id, ctx.user.id, body);
  return { ok: true };
});
