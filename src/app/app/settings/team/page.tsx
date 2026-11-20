import { TeamManager } from "@/components/settings-forms";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { listTeam } from "@/services/team";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireContext();
  const t = await listTeam(ctx.ws.id);
  return <TeamManager me={ctx.user.id} myRole={ctx.role} canManage={can(ctx.role, "team.manage")} members={t.members} invites={t.invites.map((i) => ({ ...i, expires_at: new Date(i.expires_at).toISOString() }))} />;
}
