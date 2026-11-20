import { formatMoney } from "@/lib/money";
import type { PdfInvoice } from "@/lib/pdf";
import { getInvoice } from "@/services/invoices";
import { getSettings } from "@/services/workspace";

export async function buildInvoicePdfData(wsId: string, invoiceId: string): Promise<PdfInvoice> {
  const s = await getSettings(wsId);
  const d = await getInvoice(wsId, invoiceId, s.timezone);
  const inv = d.invoice;
  void formatMoney;
  return {
    business: { name: s.businessName, email: s.email, phone: s.phone, address: s.address, taxId: s.taxId, website: s.website, logoDataUrl: s.logoDataUrl, color: s.brandColor, footer: s.invoiceFooter, paymentInstructions: s.paymentInstructions },
    client: { name: d.client.name, businessName: d.client.business_name, email: d.client.email, address: d.client.billing_address, taxId: d.client.tax_id },
    invoice: {
      number: inv.number, title: inv.title, currency: inv.currency, issueDate: inv.issueDate, dueDate: inv.dueDate, status: inv.status,
      items: d.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unit_price, lineTotal: i.line_total })),
      subtotal: inv.subtotal, discountTotal: inv.discountTotal, discountLabel: inv.discountType === "percent" ? `Discount (${Number(inv.discountValue)}%)` : "Discount",
      taxTotal: inv.taxTotal, taxRate: inv.taxRate, total: inv.total, paid: inv.paid, balance: inv.balance, notes: inv.notes, paymentTerms: inv.paymentTerms,
    },
    payments: d.payments.map((p) => ({ date: p.paid_at, method: p.method, amount: p.amount, kind: p.kind })),
  };
}
