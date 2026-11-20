import { redirect } from "next/navigation";
import { InvoiceEditor } from "@/components/invoice-editor";
import { PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { addDays, todayInTz } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { clientsForSelect } from "@/services/clients";
import { getSettings } from "@/services/workspace";
import { rows, sql } from "@/lib/sql";

export const metadata = { title: "New invoice" };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  if (!can(ctx.role, "invoices.write")) redirect("/app/invoices");
  const s = await getSettings(ctx.ws.id);
  const clients = await rows<{ id: string; name: string; business_name: string | null; email: string | null; billing_address: string | null }>(sql`select id, name, business_name, email, billing_address from clients where workspace_id = ${ctx.ws.id} and archived_at is null order by name limit 1000`);
  void clientsForSelect;
  const today = todayInTz(s.timezone);
  return (
    <>
      <PageHeader title="New invoice" crumbs={[{ href: "/app/invoices", label: "Invoices" }, { label: "New" }]} sub="Totals are calculated with exact decimals when you save." />
      <InvoiceEditor
        clients={clients}
        isEdit={false}
        termsDays={s.paymentTermsDays}
        numberHint={s.numberFormat.replace("{YYYY}", today.slice(0, 4)).replace(/\{(N+)\}/, (_, n: string) => "1".padStart(n.length, "0"))}
        business={{ name: s.businessName, address: s.address, email: s.email, phone: s.phone, taxId: s.taxId, logo: s.logoDataUrl, color: s.brandColor, footer: s.invoiceFooter, paymentInstructions: s.paymentInstructions }}
        initial={{
          clientId: sp.client && clients.some((c) => c.id === sp.client) ? sp.client : "", title: "", number: "", currency: s.defaultCurrency, issueDate: today, dueDate: addDays(today, s.paymentTermsDays),
          items: [{ description: "", quantity: "1", unitPrice: "" }], discountType: "none", discountValue: "0", taxRate: String(Number(s.defaultTaxRate)), paymentTerms: s.defaultTerms ?? "", notes: "", internalNotes: "",
        }}
      />
    </>
  );
}
