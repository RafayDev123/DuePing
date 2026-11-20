import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing";

export const metadata: Metadata = { title: "Privacy", description: "How DuePing handles account, invoice, client and payment information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[720px] px-4 pt-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Privacy" }]} />
      <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Privacy</h1>
      <div className="prose-dp mt-6 text-[15.5px]">
        <p><b>Template notice:</b> this page summarises what the software does. The operator of a DuePing deployment must supply their own legal entity, contact details and jurisdiction-specific terms before launch.</p>
        <h2>What is stored</h2>
        <ul><li>Account: name, email, salted password hash.</li><li>Workspace data you enter: clients, invoices, payments, notes, attachments, settings.</li><li>Communication records: reminder schedules, email delivery status, WhatsApp link-opened events.</li><li>Client portal events: view/download/report events with a hashed IP address.</li><li>Audit logs of important actions.</li></ul>
        <h2>What is never stored</h2>
        <p>Card numbers, bank passwords or online-banking credentials. Do not enter them anywhere.</p>
        <h2>Who can see it</h2>
        <p>Only members of your workspace, according to their role. Platform administrators see operational counts, not invoice amounts or notes. Clients only see their own invoice through a private link; internal notes are never shown.</p>
        <h2>Your controls</h2>
        <p>Export workspace data as JSON, revoke client links, remove team members, and delete the workspace in Settings → Data &amp; privacy.</p>
        <h2>Third parties</h2>
        <p>If you configure them, your email provider (Resend) and the WhatsApp Business Platform receive the message content and recipient details needed to send messages.</p>
      </div>
    </article>
  );
}
