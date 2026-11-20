import type { Metadata } from "next";
import { Breadcrumbs, CtaBand, FaqList, JsonLd } from "@/components/marketing";
import { FAQS, breadcrumbJsonLd, faqJsonLd } from "@/lib/site";

export const metadata: Metadata = { title: "FAQ", description: "Answers about DuePing: payments, reminders, WhatsApp, privacy, imports and teams.", alternates: { canonical: "/faq" } };

export default function FaqPage() {
  return (
    <>
      <JsonLd data={[faqJsonLd(FAQS), breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])]} />
      <div className="mx-auto max-w-[780px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "FAQ" }]} />
        <h1 className="m-0 mb-8 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Frequently asked questions</h1>
        <FaqList items={FAQS} />
      </div>
      <CtaBand />
    </>
  );
}
