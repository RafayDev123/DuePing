import { DataControls } from "@/components/settings-forms";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { one, sql } from "@/lib/sql";

export const metadata = { title: "Data & privacy" };

export default async function DataPage() {
  const ctx = await requireContext();
  const demo = await one(sql`select 1 from clients where workspace_id = ${ctx.ws.id} and is_demo limit 1`);
  return <DataControls wsName={ctx.ws.name} isOwner={ctx.role === "owner"} canManage={can(ctx.role, "settings.manage")} hasDemo={!!demo} />;
}
