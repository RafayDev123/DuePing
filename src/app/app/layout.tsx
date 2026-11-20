import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { one, sql } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Workspace", template: "%s | DuePing" }, robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();
  const n = await one<{ n: number }>(sql`select count(*)::int as n from notifications where workspace_id = ${ctx.ws.id} and read_at is null`);
  return (
    <Shell user={ctx.user} ws={ctx.ws} workspaces={ctx.workspaces} role={ctx.role} unread={n?.n ?? 0} canWrite={can(ctx.role, "invoices.write")}>
      {children}
    </Shell>
  );
}
