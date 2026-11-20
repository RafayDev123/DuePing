import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Breadcrumbs, CtaBand, FaqList, JsonLd } from "@/components/marketing";
import { breadcrumbJsonLd } from "@/lib/site";

export const metadata: Metadata = { title: "Pricing", description: "DuePing is free to start. Paid plans are not enabled yet — here is what exists today and what is planned.", alternates: { canonical: "/pricing" } };

const FREE = ["Unlimited clients and invoices", "Partial payments, reversals and audit log", "Branded PDFs and private client links", "CSV and PDF import", "Reports with CSV / XLSX / PDF export", "Email reminders (bring your own provider)", "WhatsApp click-to-chat follow-ups", "Multiple workspaces and team roles"];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }])} />
      <div className="mx-auto max-w-[900px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Pricing" }]} />
        <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold">Simple pricing — currently free</h1>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">Billing is not connected in this release, so every workspace is on the Free plan. We&apos;ll announce paid plans before charging anyone.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="card p-7" style={{ borderColor: "var(--accent)" }} aria-labelledby="p-free">
            <h2 id="p-free" className="m-0 text-[18px] font-semibold">Free</h2><p className="m-0 mt-1 font-display text-[34px] font-bold">$0</p>
            <ul className="m-0 mt-4 list-none space-y-2 p-0 text-[14.5px]">{FREE.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-1 shrink-0" style={{ color: "var(--success)" }} />{f}</li>)}</ul>
            <Link href="/signup" className="btn btn-primary mt-6 w-full">Start managing invoices</Link>
          </section>
          <section className="card p-7" aria-labelledby="p-paid">
            <h2 id="p-paid" className="m-0 text-[18px] font-semibold">Paid plans</h2><p className="m-0 mt-1 text-[16px] font-semibold text-muted">Not available yet</p>
            <p className="mt-4 text-[14.5px] text-muted">Larger teams, higher usage limits and managed email sending are on the roadmap. There are no prices to show because none have been set, and we won&apos;t invent them.</p>
            <Link href="/contact" className="btn mt-6 w-full">Tell us what you need</Link>
          </section>
        </div>
        <h2 className="mb-4 mt-14 text-[22px] font-semibold">Costs you may incur elsewhere</h2>
        <FaqList items={[{ q: "Email sending", a: "Reminders and invoice emails go through your own provider account (Resend). Providers typically have a free tier and usage-based pricing; check their current pricing." }, { q: "WhatsApp", a: "Click-to-chat links are free to use. The optional WhatsApp Business Platform API is billed by Meta per its own pricing and requires business verification and approved templates." }, { q: "Hosting", a: "If you self-host DuePing you pay for your own database, web hosting and worker." }]} />
      </div>
      <CtaBand />
    </>
  );
}
