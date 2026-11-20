import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Send the DuePing team a question or feedback.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[560px] px-4 pt-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />
      <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Contact</h1>
      <p className="mb-8 mt-3 text-muted">Questions, feedback or something not working? Send a note and it will be stored for the team to read.</p>
      <ContactForm />
    </div>
  );
}
