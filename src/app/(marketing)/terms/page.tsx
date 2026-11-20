import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing";

export const metadata: Metadata = { title: "Terms", description: "Terms of use summary for DuePing.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[720px] px-4 pt-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Terms" }]} />
      <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Terms</h1>
      <div className="prose-dp mt-6 text-[15.5px]">
        <p><b>Template notice:</b> the operator of a deployment must replace this summary with legally reviewed terms.</p>
        <h2>The service</h2>
        <p>DuePing is a tool for tracking invoices and payments and for preparing and sending follow-up messages. It is not a bank, payment processor, collections agency or regulated accounting service, and it does not give legal, tax or financial advice.</p>
        <h2>Your responsibilities</h2>
        <ul><li>Only record payments you have confirmed received.</li><li>Only message people you are entitled to contact, and follow the rules of your email and WhatsApp providers and applicable law.</li><li>Keep your credentials safe and your invoice data accurate.</li></ul>
        <h2>Availability</h2>
        <p>The service is provided as-is. Delivery of email or WhatsApp messages depends on third-party providers and cannot be guaranteed.</p>
      </div>
    </article>
  );
}
