import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";

const TABS = [["/app/settings", "Business"], ["/app/settings/email", "Email delivery"], ["/app/settings/team", "Team"], ["/app/settings/recurring", "Recurring"], ["/app/settings/data", "Data & privacy"], ["/app/settings/audit", "Audit log"]];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" sub="Business details, delivery, team and privacy." />
      <nav aria-label="Settings sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap px-4 py-2.5 text-[13.5px] font-medium text-muted hover:text-ink">{label}</Link>)}
      </nav>
      {children}
    </>
  );
}
