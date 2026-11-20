import type { Metadata } from "next";
import { Breadcrumbs, JsonLd } from "@/components/marketing";
import { breadcrumbJsonLd, UPDATED } from "@/lib/site";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Help center", description: "How to create invoices, record partial payments, set up reminders, use the client portal, import data and keep your workspace secure.", alternates: { canonical: "/help" } };

const SECTIONS: { id: string; title: string; steps: string[] }[] = [
  { id: "start", title: "Getting started", steps: ["Create an account. Your business workspace is created for you.", "In Settings, add your business details, logo, brand colour and payment instructions.", "Add a client, then choose New invoice.", "Use ‘Load demo data’ on the empty overview to explore — demo rows are labelled [Demo] and removable."] },
  { id: "invoices", title: "Invoices", steps: ["Drafts are editable; sent invoices are locked. Use Duplicate to start from an old invoice.", "Status is derived: Paid when payments cover the total, Overdue after the due date (in your timezone), Partially paid when some money was recorded.", "Download a PDF, print, email the invoice, or copy a private link.", "Void or cancel an invoice only after reversing any recorded payments."] },
  { id: "payments", title: "Payments and corrections", steps: ["Open an invoice → Record payment. Enter what you actually received.", "Amounts above the remaining balance are rejected.", "Mistake? Use Correct (reverse + re-enter) or Reverse. Both keep the original entry.", "When a client reports a payment, review it under Payments. Approve only after confirming the money arrived."] },
  { id: "reminders", title: "Reminders", steps: ["Go to Reminders and complete the four checklist steps: provider, sender verification, template review, preferences.", "Enable automatic reminders. Edit rules to change timing, channel and language.", "Pause a single reminder or a whole client. Paid, voided or rescheduled invoices stop their reminders automatically.", "WhatsApp rules create a task: open the invoice and use the WhatsApp button to review and send."] },
  { id: "portal", title: "Client portal", steps: ["Copy private link on a sent invoice. The link is shown once and expires (default 60 days).", "Revoke all links from the invoice’s More menu.", "Clients can view, download the PDF and report a payment. Reports never mark an invoice paid."] },
  { id: "import", title: "Import", steps: ["CSV: upload, map columns, validate, review duplicates and errors, confirm. Download an error report for rejected rows.", "PDF: upload, review the extracted fields (scanned PDFs need manual entry), tick the confirmation box, create.", "Imported invoices are created as sent historical records."] },
  { id: "security", title: "Security and privacy", steps: ["Roles: owner, admin, accountant, member, viewer.", "Integration keys are encrypted; they are never shown again after saving.", "Export all data or delete the workspace in Settings → Data & privacy.", "Never enter card numbers or banking passwords anywhere in DuePing."] },
];

export default function HelpPage() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Help center", path: "/help" }])} />
      <div className="mx-auto grid max-w-[1000px] gap-10 px-4 pt-12 lg:grid-cols-[220px_1fr]">
        <div className="lg:col-span-2"><Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Help center" }]} /><h1 className="m-0 text-[clamp(1.9rem,4.5vw,2.6rem)] font-semibold">Help center</h1><p className="mt-2 text-[13px] text-muted">Updated {formatDate(UPDATED)}</p></div>
        <nav aria-label="Help sections" className="lg:sticky lg:top-20 lg:self-start"><ul className="m-0 flex list-none flex-wrap gap-2 p-0 lg:flex-col lg:gap-1">{SECTIONS.map((s) => <li key={s.id}><a className="link text-[14px]" href={`#${s.id}`}>{s.title}</a></li>)}</ul></nav>
        <div className="space-y-10">{SECTIONS.map((s) => <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`} className="scroll-mt-24"><h2 id={`h-${s.id}`} className="m-0 mb-3 text-[22px] font-semibold">{s.title}</h2><ol className="m-0 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol></section>)}</div>
      </div>
    </>
  );
}
