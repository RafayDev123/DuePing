import Link from "next/link";
import type { Metadata } from "next";
import { BellRing, FileText, MessageCircle, ShieldCheck, Upload, Wallet } from "lucide-react";
import { CtaBand, FaqList, JsonLd } from "@/components/marketing";
import { HeroPreview } from "@/components/hero-preview";
import { FAQS, faqJsonLd, orgJsonLd, softwareJsonLd, websiteJsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "DuePing — Invoice tracking and payment reminders for freelancers" },
  description: "Keep invoices organized, track every payment and send professional reminders from one simple workspace.",
  alternates: { canonical: "/" },
  openGraph: { title: "DuePing — Track every invoice. Follow up without the stress.", description: "Invoice tracking, partial payments and respectful reminders in one workspace.", url: "/" },
};

const FEATURES = [
  { icon: FileText, t: "Invoices that stay accurate", b: "Exact decimal totals, branded PDFs, configurable numbering and statuses derived from the ledger.", href: "/invoice-management" },
  { icon: Wallet, t: "A real payment ledger", b: "Partial payments, reversals and corrections — history is never overwritten.", href: "/payment-tracking" },
  { icon: BellRing, t: "Reminders you control", b: "Polite schedules in English, Urdu and Roman Urdu. Off until you switch them on.", href: "/payment-reminders" },
  { icon: MessageCircle, t: "WhatsApp, sent by you", b: "Official click-to-chat links with the message prefilled. You review and send.", href: "/whatsapp-follow-ups" },
  { icon: Upload, t: "Bring your invoices along", b: "Import CSV with mapping, or PDFs with a human review step.", href: "/help#import" },
  { icon: ShieldCheck, t: "Private by default", b: "Expiring, revocable client links; hashed tokens; audit log; role-based access.", href: "/help#security" },
];

export default function Home() {
  return (
    <>
      <JsonLd data={[orgJsonLd, websiteJsonLd, softwareJsonLd, faqJsonLd(FAQS.slice(0, 6))]} />
      <section className="mx-auto max-w-[1120px] px-4 pb-6 pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <p className="m-0 mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Invoice management · payment tracking · reminders</p>
          <h1 className="m-0 text-[clamp(2.2rem,5.5vw,3.8rem)] font-semibold leading-[1.04]">Spend less time chasing payments.</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-muted">Keep invoices organized, track every payment and send professional reminders from one simple workspace.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/signup" className="btn btn-primary" style={{ minHeight: 46, padding: "0 22px", fontSize: 15 }}>Start managing invoices</Link><Link href="/features" className="btn" style={{ minHeight: 46, padding: "0 22px", fontSize: 15 }}>Explore features</Link></div>
          <p className="mt-3 text-[13px] text-muted">Free to start · No card required · DuePing records payments; it never holds your money.</p>
        </div>
        <div className="mt-12"><HeroPreview /></div>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] px-4" aria-labelledby="h-feat">
        <h2 id="h-feat" className="m-0 max-w-xl text-[30px] font-semibold">Everything between “invoice sent” and “payment received”</h2>
        <p className="mt-2 max-w-2xl text-muted">Each part does one job and does it honestly — including saying so when something is only accepted, not delivered, or reported, not confirmed.</p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => { const I = f.icon; return (
            <Link key={f.t} href={f.href} className="bg-surface p-6 hover:bg-surface2"><I size={20} style={{ color: "var(--accent-text)" }} aria-hidden /><h3 className="m-0 mb-1 mt-3 text-[16px] font-semibold">{f.t}</h3><p className="m-0 text-[14px] text-muted">{f.b}</p></Link>
          ); })}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] px-4" aria-labelledby="h-flow">
        <h2 id="h-flow" className="m-0 text-[30px] font-semibold">A reminder workflow with a safety catch</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[["1", "Connect a provider", "Add your email provider key; it is stored encrypted."], ["2", "Verify the sender", "A test email must be accepted before reminders can be enabled."], ["3", "Review templates", "Read exactly what clients will receive. Edit anything."], ["4", "Switch it on", "Reminders schedule from your rules and stop when paid, voided or rescheduled."]].map(([n, t, b]) => (
            <div key={n} className="card p-5"><span className="mono text-[13px]" style={{ color: "var(--accent-text)" }}>0{n}</span><h3 className="m-0 mb-1 mt-2 text-[15px] font-semibold">{t}</h3><p className="m-0 text-[13.5px] text-muted">{b}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] px-4" aria-labelledby="h-use">
        <h2 id="h-use" className="m-0 text-[30px] font-semibold">Built for people who bill for their time</h2>
        <ul className="mt-6 flex list-none flex-wrap gap-2 p-0">{["Freelance developers", "Designers", "Marketing agencies", "Consultants", "Virtual assistants", "Tutors and coaches", "Small service businesses"].map((u) => <li key={u} className="rounded-full border border-line bg-surface px-4 py-2 text-[14px]">{u}</li>)}</ul>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[["Freelancers", "One list of everything you're owed, per currency, with the next follow-up already scheduled."], ["Agencies", "Workspaces per business, roles for your team, audit trail for every financial change."], ["Service providers", "WhatsApp follow-ups and Urdu / Roman Urdu templates for the clients who prefer them."]].map(([t, b]) => <div key={t} className="card p-5"><h3 className="m-0 mb-1 text-[15px] font-semibold">{t}</h3><p className="m-0 text-[14px] text-muted">{b}</p></div>)}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] px-4" aria-labelledby="h-how">
        <h2 id="h-how" className="m-0 text-[30px] font-semibold">How it works</h2>
        <ol className="mt-6 grid list-none gap-4 p-0 md:grid-cols-4">{["Add a client", "Create and send an invoice", "Record payments as they arrive", "Follow up when something is late"].map((s, i) => <li key={s} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}>{i + 1}</span><span className="pt-1 text-[15px] font-medium">{s}</span></li>)}</ol>
      </section>

      <section className="mx-auto mt-20 max-w-[1120px] px-4" aria-labelledby="h-sec">
        <div className="grid gap-8 rounded-xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-2">
          <div><h2 id="h-sec" className="m-0 text-[28px] font-semibold">Security and privacy, in plain terms</h2><p className="mt-3 text-muted">Invoices are financial documents. DuePing treats them that way.</p></div>
          <ul className="m-0 list-disc space-y-2 pl-5 text-[14.5px]">
            <li>Client links use random tokens; only a hash is stored. They expire and can be revoked.</li>
            <li>Private pages are marked noindex and rate-limited.</li>
            <li>Integration credentials are encrypted at rest.</li>
            <li>Every query is scoped to your workspace and checked against your role.</li>
            <li>No card numbers or bank passwords are ever requested or stored.</li>
            <li>Export your data or delete your workspace whenever you like.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[820px] px-4" aria-labelledby="h-faq">
        <h2 id="h-faq" className="m-0 mb-6 text-[30px] font-semibold">Frequently asked questions</h2>
        <FaqList items={FAQS.slice(0, 6)} />
        <p className="mt-4 text-[14px]"><Link className="link" href="/faq">See all questions</Link></p>
      </section>
      <CtaBand />
    </>
  );
}
