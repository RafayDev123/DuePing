import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const metadata = { title: "Import invoices" };

export default async function ImportPage() {
  const ctx = await requireContext();
  if (!can(ctx.role, "import.run")) redirect("/app");
  return (
    <>
      <PageHeader title="Import invoices" sub="Bring existing invoices in from a spreadsheet or PDF. You always review before anything is saved." />
      <ImportWizard />
    </>
  );
}
