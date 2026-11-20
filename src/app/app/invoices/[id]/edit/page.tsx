import { notFound, redirect } from "next/navigation";
import { InvoiceEditor } from "@/components/invoice-editor";
import { PageHeader } from "@/components/ui";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isUuid, rows, sql } from "@/lib/sql";
import { getInvoice } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ctx = await requireContext();
  if (!can(ctx.role, "invoices.write")) redirect(`/app/invoices/${id}`);
  const s = await getSettings(ctx.ws.id);
  const d = await getInvoice(ctx.ws.id, id, s.timezone).catch(() => null);
  if (!d) notFound();
  if (d.invoice.storedStatus !== "draft") redirect(`/app/invoices/${id}`);
  const clients = await rows<{ id: string; name: string; business_name: string | null; email: string | null; billing_address: string | null }>(sql`select id, name, business_name, email, billing_address from clients where workspace_id = ${ctx.ws.id} and (archived_at is null or id = ${d.client.id}) order by name limit 1000`);
  const i = d.invoice;
  return (
    <>
      <PageHeader title={`Edit ${i.number}`} crumbs={[{ href: "/app/invoices", label: "Invoices" }, { href: `/app/invoices/${id}`, label: i.number }, { label: "Edit" }]} sub="Only draft invoices can be edited. Once sent, an invoice is locked so that what the client saw never changes." />
      <InvoiceEditor
        clients={clients}
        isEdit
        termsDays={s.paymentTermsDays}
        numberHint={i.number}
        business={{ name: s.businessName, address: s.address, email: s.email, phone: s.phone, taxId: s.taxId, logo: s.logoDataUrl, color: s.brandColor, footer: s.invoiceFooter, paymentInstructions: s.paymentInstructions }}
        initial={{
          id, clientId: d.client.id, title: i.title ?? "", number: i.number, currency: i.currency, issueDate: i.issueDate, dueDate: i.dueDate,
          items: d.items.map((x) => ({ description: x.description, quantity: x.quantity, unitPrice: x.unit_price })),
          discountType: i.discountType as "none", discountValue: String(Number(i.discountValue)), taxRate: String(Number(i.taxRate)), paymentTerms: i.paymentTerms ?? "", notes: i.notes ?? "", internalNotes: i.internalNotes ?? "",
        }}
      />
    </>
  );
}
