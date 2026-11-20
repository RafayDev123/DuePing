import { redirect } from "next/navigation";
import { EmailIntegrationForm } from "@/components/settings-forms";
import { requireContext } from "@/lib/auth";
import { platformMailerConfigured } from "@/lib/env";
import { can } from "@/lib/permissions";
import { getEmailIntegration } from "@/services/integrations";

export const metadata = { title: "Email delivery" };

export default async function EmailSettings() {
  const ctx = await requireContext();
  if (!can(ctx.role, "settings.manage")) redirect("/app/settings");
  const i = await getEmailIntegration(ctx.ws.id);
  const ser = i ? { from_email: i.from_email, from_name: i.from_name, reply_to: i.reply_to, verified_at: i.verified_at ? new Date(i.verified_at).toISOString() : null, last_error: i.last_error, last_test_at: i.last_test_at ? new Date(i.last_test_at).toISOString() : null } : null;
  return <EmailIntegrationForm initial={ser} platformMailer={platformMailerConfigured()} />;
}
