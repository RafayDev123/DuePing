import { SettingsForm } from "@/components/settings-forms";
import { requireContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/services/workspace";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireContext();
  const s = await getSettings(ctx.ws.id);
  return (
    <SettingsForm canEdit={can(ctx.role, "settings.manage")} initial={{
      businessName: s.businessName, email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "", country: s.country ?? "", taxId: s.taxId ?? "", website: s.website ?? "",
      logoDataUrl: s.logoDataUrl, brandColor: s.brandColor, invoiceFooter: s.invoiceFooter ?? "", paymentInstructions: s.paymentInstructions ?? "", defaultCurrency: s.defaultCurrency,
      numberFormat: s.numberFormat, paymentTermsDays: s.paymentTermsDays, defaultTaxRate: String(Number(s.defaultTaxRate)), defaultTerms: s.defaultTerms ?? "", timezone: s.timezone,
      quietStart: s.quietStart, quietEnd: s.quietEnd, reminderSendHour: s.reminderSendHour, paymentMethods: s.paymentMethods.join(", "),
    }} />
  );
}
