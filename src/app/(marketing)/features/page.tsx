import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs, CtaBand, JsonLd } from "@/components/marketing";
import { FEATURE_PAGES, breadcrumbJsonLd } from "@/lib/site";

export const metadata: Metadata = { title: "Features", description: "Invoice management, payment tracking, reminders, WhatsApp follow-ups, imports, reports, client portal, teams and workspaces.", alternates: { canonical: "/features" } };

const MORE = [
  ["Client portal", "A private page per invoice: view, download, see recorded payments and payment instructions, and report a payment for you to verify."],
  ["Reports and exports", "Outstanding, overdue, payments, partial payments, client balances, aging, reminder performance and monthly collections — to CSV, XLSX and PDF."],
  ["Import", "CSV with mapping, validation and duplicate detection; PDFs with extraction and a mandatory review screen."],
  ["Teams and workspaces", "Multiple businesses under one login, each isolated, with owner, admin, accountant, member and viewer roles."],
  ["Recurring invoices", "Weekly to yearly schedules that create drafts for review."],
  ["Audit log and notifications", "Every important financial action is logged; in-app notifications cover due dates, payments and reminder results."],
];

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Features", path: "/features" }])} />
      <div className="mx-auto max-w-[1000px] px-4 pt-12">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Features" }]} />
        <h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.9rem)] font-semibold">Features</h1>
        <p className="mt-3 max-w-2xl text-[17px] text-muted">DuePing covers the whole path from sending an invoice to confirming payment — and is explicit about what it does and doesn&apos;t do.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">{FEATURE_PAGES.map((p) => <Link key={p.slug} href={`/${p.slug}`} className="card p-6 hover:bg-surface2"><p className="m-0 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>{p.eyebrow}</p><h2 className="m-0 mb-2 mt-1 text-[18px] font-semibold">{p.title}</h2><p className="m-0 text-[14px] text-muted">{p.description}</p></Link>)}</div>
        <h2 className="mb-4 mt-14 text-[24px] font-semibold">And the rest</h2>
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2">{MORE.map(([t, b]) => <div key={t}><dt className="text-[15px] font-semibold">{t}</dt><dd className="m-0 mt-1 text-[14px] text-muted">{b}</dd></div>)}</dl>
      </div>
      <CtaBand />
    </>
  );
}
