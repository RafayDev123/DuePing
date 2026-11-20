import type { Metadata } from "next";
import { Breadcrumbs, CtaBand, JsonLd } from "@/components/marketing";
import { AUTHOR, breadcrumbJsonLd, orgJsonLd } from "@/lib/site";

export const metadata: Metadata = { title: "About DuePing", description: "DuePing helps independent professionals and small businesses organise invoices, track payments and follow up respectfully.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <>
      <JsonLd data={[orgJsonLd, breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])]} />
      <article className="mx-auto max-w-[760px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
        <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold">About DuePing</h1>
        <div className="prose-dp mt-6 text-[16px]">
          <p><b>DuePing</b> is invoice management, payment tracking and reminder software. Its mission is to give independent professionals and businesses an easy way to organise invoices, understand what is outstanding and communicate professionally with clients.</p>
          <h2>What DuePing is</h2>
          <p>A web app where you create and send invoices, record full and partial payments in an append-only ledger, and follow up with clients by email or WhatsApp — with every automatic message opt-in and every status derived from your real records.</p>
          <h2>What DuePing is not</h2>
          <p>It is not a bank, a payment processor or a regulated accounting service. It does not hold money, and it never treats a client&apos;s claim of payment as confirmed until you confirm it.</p>
          <h2>Principles</h2>
          <ol><li>Simple invoice management.</li><li>Accurate payment tracking.</li><li>Professional customer communication.</li><li>Useful reminders — never unexpected ones.</li><li>Clear financial visibility, per currency.</li><li>Privacy and security by default.</li><li>No fake numbers: no invented testimonials, customer counts or success rates.</li></ol>
          <h2>Editorial standards</h2>
          <p>Guides are written by the {AUTHOR.name} ({AUTHOR.role}). {AUTHOR.editor}. We cite sources where we make factual claims and show publication and update dates.</p>
        </div>
      </article>
      <CtaBand />
    </>
  );
}
