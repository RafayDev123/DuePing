export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "DuePing";
export const TAGLINE = "Track Every Invoice. Follow Up Without the Stress.";
export const UPDATED = "2026-03-01";

export const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Guides" },
  { href: "/help", label: "Help" },
  { href: "/faq", label: "FAQ" },
];

export interface FeaturePageData {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  intro: string;
  answer: string;
  points: { title: string; body: string }[];
  steps: string[];
  honest: string;
}

export const FEATURE_PAGES: FeaturePageData[] = [
  {
    slug: "invoice-management",
    title: "Invoice management for freelancers and small teams",
    metaTitle: "Invoice management software for freelancers",
    description: "Create, send and track invoices with exact decimal totals, configurable numbering, branded PDFs and private client links.",
    eyebrow: "Invoice management",
    intro: "Create invoices once, keep them organised, and always know which are draft, sent, partly paid, overdue or closed.",
    answer: "DuePing lets you build an invoice with line items, discounts and tax, preview the exact PDF layout while you type, and share it through a private link. Status is derived from the payment ledger and due date, so an invoice can never claim to be paid when it isn't.",
    points: [
      { title: "Totals you can trust", body: "Line items, discounts and tax are calculated with integer arithmetic per currency — no floating-point drift." },
      { title: "Numbering that fits", body: "Use a format like DP-2026-0001. Numbers are unique per business and generated safely even when two people save at once." },
      { title: "Branded PDFs", body: "Logo, brand colour, business details, payment instructions, payment history and remaining balance on a clean A4 document." },
      { title: "Locked once sent", body: "Drafts are editable. Sent invoices are locked, so what your client saw never silently changes. Duplicate, void or cancel instead." },
      { title: "Import what you have", body: "Bring invoices in from CSV (with column mapping and an error report) or from PDFs with a mandatory review step." },
      { title: "Recurring drafts", body: "Weekly, monthly, quarterly, yearly or custom schedules create drafts for your review — never automatic sends." },
    ],
    steps: ["Add a client (name, email, WhatsApp number, preferred language).", "Create the invoice and watch the live preview update.", "Save as draft, or save and mark as sent.", "Email it, copy a private link, or download the PDF.", "Record payments as they arrive."],
    honest: "DuePing is not accounting software and does not file taxes. It manages invoices and payment follow-up.",
  },
  {
    slug: "payment-tracking",
    title: "Client payment tracking with a real ledger",
    metaTitle: "Client payment tracking and partial payments",
    description: "Record full and partial payments in an append-only ledger. Reverse or correct with a full audit trail and never lose history.",
    eyebrow: "Payment tracking",
    intro: "See what each client owes, per currency, and keep a payment history that nobody can quietly rewrite.",
    answer: "Every payment is a ledger entry tied to an invoice. Partial payments reduce the remaining balance; mistakes are fixed with a reversal entry plus a linked correction. Nothing is overwritten or deleted, and every change lands in the audit log.",
    points: [
      { title: "Partial payments", body: "Invoice of $500, payments of $150 and $200 — the balance is $150, and each payment stays visible." },
      { title: "Reversal and correction", body: "A wrong amount is reversed (with a reason) and re-entered. Both entries stay in the ledger." },
      { title: "Overpayment protection", body: "DuePing rejects a payment larger than the remaining balance so totals stay accurate." },
      { title: "Client-reported payments", body: "Clients can say they paid and attach a reference or proof. That creates a verification request — the invoice is not marked paid until you confirm." },
      { title: "Multiple currencies", body: "Balances are shown per currency and never added together without a stated exchange rate." },
      { title: "Methods you use", body: "Bank transfer, cash, card, PayPal, Stripe, Wise, JazzCash, Easypaisa — plus your own custom methods." },
    ],
    steps: ["Open an invoice and choose Record payment.", "Enter the amount you actually received, the date, method and reference.", "The remaining balance and status update immediately.", "Need to fix something? Reverse or correct it from the ledger."],
    honest: "DuePing records payments you confirm. It does not move money, hold funds or connect to bank accounts, and it never treats a client's click as received money.",
  },
  {
    slug: "payment-reminders",
    title: "Automatic payment reminders that stay respectful",
    metaTitle: "Automated invoice payment reminders",
    description: "Schedule polite reminders before and after the due date. Nothing sends until you configure a provider, review templates and switch it on.",
    eyebrow: "Payment reminders",
    intro: "A schedule you control: gentle nudges before the due date, a clear note on the day, and respectful follow-ups when an invoice is late.",
    answer: "Reminder rules are offsets from the due date (for example 3 days before, on the day, 3, 7 and 14 days after). Automatic sending stays off until you connect an email provider, verify the sender with a test, review the templates and confirm your preferences. Reminders stop on their own when an invoice is paid, voided or its due date changes.",
    points: [
      { title: "Opt-in by design", body: "A four-step checklist guards the switch. Never an unexpected message by default." },
      { title: "Templates in three languages", body: "English, Urdu and Roman Urdu — for upcoming, due today, first overdue, follow-up, final and payment confirmation." },
      { title: "Quiet hours and timezones", body: "Reminders respect your timezone and quiet hours, and move to the next sensible time." },
      { title: "No duplicates", body: "Idempotency keys and row-level claiming mean a worker restart cannot send the same reminder twice." },
      { title: "Honest delivery states", body: "“Accepted by provider” is shown separately from “delivered” and “bounced”, which appear only when the provider reports them." },
      { title: "Pause and retry", body: "Pause a single reminder or a whole client, reschedule, and retry failures when it's safe." },
    ],
    steps: ["Add your email provider key and sender.", "Send yourself a test email to verify the sender.", "Review the templates and quiet hours.", "Enable automatic reminders.", "Watch the calendar fill with scheduled reminders."],
    honest: "Templates are polite by design. DuePing doesn't include threatening or harassing wording, and legal collection steps are outside its scope.",
  },
  {
    slug: "whatsapp-follow-ups",
    title: "WhatsApp follow-ups, sent by you",
    metaTitle: "WhatsApp payment follow-ups with click-to-chat",
    description: "Prepare prefilled WhatsApp messages with official click-to-chat links. You review and send. Optional official Business API adapter.",
    eyebrow: "WhatsApp follow-ups",
    intro: "Many clients answer WhatsApp faster than email. DuePing prepares the message; you press send.",
    answer: "DuePing builds an official WhatsApp click-to-chat link with a prefilled message containing the client's name, invoice number, remaining amount, due date and a private invoice link. Your WhatsApp opens, you read the message and send it yourself. DuePing records that you opened the link — not that the message was delivered.",
    points: [
      { title: "Official links only", body: "wa.me click-to-chat. No scraping of WhatsApp Web, no automation of personal accounts, no unofficial libraries." },
      { title: "Review before sending", body: "Choose the message type, read the preview, then open WhatsApp. Nothing leaves without your tap." },
      { title: "Opened ≠ delivered", body: "The history labels a link as opened. Delivery is never claimed for manual messages." },
      { title: "Consent recorded", body: "Mark a client's WhatsApp consent. Automated Business API messaging requires it." },
      { title: "Business API adapter", body: "If you configure the official WhatsApp Business Platform and an approved template, scheduled WhatsApp reminders can be sent through it — only for consenting clients." },
    ],
    steps: ["Save the client's phone in international format (+923001234567).", "Open an invoice with a balance and choose WhatsApp.", "Pick a message type and check the preview.", "Open WhatsApp and send."],
    honest: "The Business API adapter is implemented but untested without your credentials. Platform policies, template approval and business verification are your responsibility.",
  },
];

export interface FaqItem { q: string; a: string }
export const FAQS: FaqItem[] = [
  { q: "What is DuePing?", a: "DuePing is a web app for managing invoices, tracking full and partial payments, and following up with clients using scheduled reminders and WhatsApp click-to-chat links." },
  { q: "Does DuePing process payments or hold my money?", a: "No. DuePing records payments that you confirm. It is not a bank, payment processor or regulated accounting service." },
  { q: "Will DuePing email my clients without asking me?", a: "No. Automatic reminders are off by default. You must configure a sending provider, verify the sender, review the templates, confirm preferences and then switch reminders on." },
  { q: "What happens if a client says they paid?", a: "Clients can report a payment from their private invoice page. That creates a verification request. The invoice is only marked paid after you confirm the money arrived and record it." },
  { q: "Can I track partial payments?", a: "Yes. Each payment is a ledger entry; the invoice shows what has been paid and what remains. Corrections are made with reversal entries so history is preserved." },
  { q: "Does it support more than one currency?", a: "Yes. Every invoice has its own currency. Totals are always shown per currency and are never merged unless an exchange rate is explicitly applied." },
  { q: "How does WhatsApp work?", a: "DuePing creates an official click-to-chat link with a prefilled message. You review and send it yourself. An optional adapter for the official WhatsApp Business Platform exists for businesses that have it configured." },
  { q: "Are client invoice links private?", a: "Each link contains a long random token; only its hash is stored. Links can expire, can be revoked, are rate-limited and are marked noindex." },
  { q: "Can I import existing invoices?", a: "Yes. Import CSV files with column mapping, validation, duplicate detection and an error report, or upload a PDF and review the extracted details before anything is saved." },
  { q: "Can my team use it?", a: "Yes. Workspaces support owner, admin, accountant, member and read-only roles, and important financial actions are written to an audit log." },
];

export interface Block { t: "p" | "h2" | "ul" | "ol" | "quote"; text?: string; items?: string[] }
export interface Post {
  slug: string; title: string; description: string; published: string; updated: string; readMins: number; direct: string; blocks: Block[]; sources: { label: string; url: string }[];
}

export const AUTHOR = { name: "DuePing Editorial Team", role: "Product and guides", editor: "Reviewed by the DuePing product team" };

export const POSTS: Post[] = [
  {
    slug: "how-to-remind-a-client-about-an-unpaid-invoice",
    title: "How do I remind a client about an unpaid invoice?",
    description: "A calm, step-by-step way to remind a client about an unpaid invoice, with wording you can copy.",
    published: "2026-01-12", updated: "2026-03-01", readMins: 4,
    direct: "Send a short, friendly message that names the invoice, the amount and the due date, links to the invoice, and asks the client to tell you if they have already paid. Keep the tone neutral and make paying easy.",
    blocks: [
      { t: "h2", text: "Start by checking your own records" },
      { t: "p", text: "Before writing, confirm the invoice really is unpaid: look for payments recorded against it, including partial ones. A reminder for money you already received is the quickest way to damage a relationship." },
      { t: "h2", text: "A simple reminder structure" },
      { t: "ol", items: ["Greet the client by name.", "State the invoice number, remaining balance and due date.", "Link to the invoice or attach it.", "Say how to pay, or point to the payment instructions.", "Invite them to reply if they have already paid or if something is unclear.", "Thank them."] },
      { t: "h2", text: "A template you can adapt" },
      { t: "quote", text: "Subject: Friendly Payment Reminder — Invoice DP-2026-0001\n\nHello Sam,\n\nThis is a friendly reminder that invoice DP-2026-0001 for $250.00 is due on 12 March 2026. You can view it here: [link].\n\nPlease let us know if you have already completed the payment.\n\nThank you for working with us.\nNorthlight Studio" },
      { t: "h2", text: "Choose the channel your client actually reads" },
      { t: "p", text: "Email leaves a record; WhatsApp is often read sooner. If you use WhatsApp, send it yourself from your own account or through the official Business Platform with the client's consent." },
    ],
    sources: [{ label: "WhatsApp Business Messaging Policy", url: "https://business.whatsapp.com/policy" }],
  },
  {
    slug: "when-to-send-a-payment-reminder",
    title: "When should I send a payment reminder?",
    description: "A practical reminder timeline — before, on and after the due date — and how to adapt it.",
    published: "2026-01-19", updated: "2026-03-01", readMins: 4,
    direct: "A common cadence is a heads-up a few days before the due date, a note on the due date, and follow-ups at roughly one, two and four weeks overdue. Adjust it to your payment terms and your client's habits — there is no universal schedule.",
    blocks: [
      { t: "h2", text: "A starting schedule" },
      { t: "ul", items: ["3 days before the due date — a gentle heads-up.", "On the due date — a clear, friendly reminder.", "3 days after — the first overdue notice.", "7 days after — a follow-up that offers help.", "14 days after — a final polite reminder."] },
      { t: "p", text: "These are DuePing's editable defaults, not rules. Net-7 invoices may need a tighter rhythm; large project invoices may deserve a phone call." },
      { t: "h2", text: "Respect time and place" },
      { t: "p", text: "Send during working hours in your client's timezone and avoid late evenings. DuePing's quiet hours move a reminder to the next sensible time." },
      { t: "h2", text: "Stop the moment it's paid" },
      { t: "p", text: "Any pending reminder should be cancelled as soon as a payment brings the balance to zero, the invoice is voided, or the due date changes." },
    ],
    sources: [{ label: "UK Late Payment of Commercial Debts (Interest) Act 1998", url: "https://www.legislation.gov.uk/ukpga/1998/20/contents" }],
  },
  {
    slug: "how-to-track-partial-invoice-payments",
    title: "How do I track partial invoice payments?",
    description: "Keep an accurate balance when a client pays an invoice in instalments.",
    published: "2026-01-26", updated: "2026-03-01", readMins: 3,
    direct: "Record each payment as its own dated entry against the invoice and calculate the remaining balance as the invoice total minus the sum of payments. Never overwrite an earlier payment — reverse and re-enter if you made a mistake.",
    blocks: [
      { t: "h2", text: "A worked example" },
      { t: "p", text: "Invoice total: $500. First payment: $150. Second payment: $200. Remaining balance: $500 − $150 − $200 = $150. The invoice stays open (and partially paid) until the remaining balance reaches zero." },
      { t: "h2", text: "What to record for each payment" },
      { t: "ul", items: ["Amount actually received", "Date received", "Method (bank transfer, cash, card…)", "Transaction reference", "Who recorded it, and any notes"] },
      { t: "h2", text: "Fixing mistakes without losing history" },
      { t: "p", text: "If a payment was entered wrongly, add a reversal that cancels it and then add the correct payment. Both entries remain, so anyone can see exactly what happened and why." },
      { t: "h2", text: "Watch out for currencies" },
      { t: "p", text: "Keep payments in the invoice's currency. If a client pays in another currency, record the amount received in the invoice currency and keep the details in the notes." },
    ],
    sources: [],
  },
  {
    slug: "what-should-an-overdue-invoice-email-say",
    title: "What should an overdue invoice email say?",
    description: "Wording for the first, second and final overdue emails — firm, respectful and free of threats.",
    published: "2026-02-02", updated: "2026-03-01", readMins: 5,
    direct: "An overdue invoice email should state the invoice number, amount and original due date, say plainly that it is now overdue, link to the invoice, invite the client to share payment details or raise any problem, and stay courteous.",
    blocks: [
      { t: "h2", text: "First overdue notice" },
      { t: "quote", text: "Hello Sam,\n\nOur records show invoice DP-2026-0001 for $250.00 was due on 12 March 2026 and is now 3 days past due.\n\nIf the payment is already on its way, thank you — please reply with the details so we can update our records.\n\nKind regards,\nNorthlight Studio" },
      { t: "h2", text: "Follow-up" },
      { t: "quote", text: "Hello Sam,\n\nI'm following up on invoice DP-2026-0001, which still has $250.00 outstanding. If anything is unclear or you need a different arrangement, just reply and we'll sort it out.\n\nThank you,\nNorthlight Studio" },
      { t: "h2", text: "Final polite reminder" },
      { t: "p", text: "Remain courteous and specific: say it is a final reminder, restate what is owed, and ask them to get in touch. Avoid threats, public shaming or language that could read as harassment — it rarely speeds up payment and can create legal and reputational risk." },
      { t: "h2", text: "What not to do" },
      { t: "ul", items: ["Don't contact at unreasonable hours.", "Don't exaggerate consequences.", "Don't send reminders after the invoice is paid."] },
    ],
    sources: [],
  },
  {
    slug: "how-can-freelancers-organize-outstanding-payments",
    title: "How can freelancers organize outstanding payments?",
    description: "A lightweight system for freelancers to see what they are owed and follow up consistently.",
    published: "2026-02-09", updated: "2026-03-01", readMins: 4,
    direct: "Keep one list of every unpaid invoice with its client, currency, due date and remaining balance, review it on a fixed day each week, and follow up from a template instead of from memory.",
    blocks: [
      { t: "h2", text: "One place for every invoice" },
      { t: "p", text: "Scattered PDFs and chat messages make it easy to forget who owes what. Record each invoice once, with client, currency, due date and status." },
      { t: "h2", text: "A weekly 15-minute review" },
      { t: "ol", items: ["Open the list of overdue invoices and send the next reminder.", "Check invoices due this week.", "Verify any payments clients say they made.", "Record payments that arrived."] },
      { t: "h2", text: "Group by currency, not in one total" },
      { t: "p", text: "If you invoice in several currencies, track each separately. A single mixed total is misleading unless you apply a stated exchange rate." },
      { t: "h2", text: "Use payment terms deliberately" },
      { t: "p", text: "Shorter terms, clear payment instructions and a deposit on large projects all reduce the amount you have to chase." },
    ],
    sources: [],
  },
  {
    slug: "what-is-an-invoice-aging-report",
    title: "What is an invoice aging report?",
    description: "Definition, buckets and how to read an aging report for unpaid invoices.",
    published: "2026-02-16", updated: "2026-03-01", readMins: 3,
    direct: "An invoice aging report groups unpaid invoices by how long they are past due, so you can see which balances need attention first. Typical buckets are not yet due, 1–7, 8–30, 31–60 and more than 60 days overdue.",
    blocks: [
      { t: "h2", text: "How the buckets work" },
      { t: "ul", items: ["Not yet due — due today or later", "1–7 days overdue", "8–30 days overdue", "31–60 days overdue", "More than 60 days overdue"] },
      { t: "p", text: "Days overdue are counted from the due date to today, using the business's timezone, so an invoice due 'today' is not yet overdue." },
      { t: "h2", text: "Reading it" },
      { t: "p", text: "Large amounts in the older buckets signal collection risk; a healthy report is weighted towards 'not yet due'. Compare the report week to week to see whether follow-ups are working." },
      { t: "h2", text: "Keep currencies apart" },
      { t: "p", text: "Show a separate row per currency. Adding different currencies together without conversion produces a meaningless number." },
    ],
    sources: [{ label: "Investopedia: Accounts receivable aging", url: "https://www.investopedia.com/terms/a/accounts-receivable-aging.asp" }],
  },
];

export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description: "DuePing is invoice management, payment tracking and reminder software for freelancers, agencies and small businesses.",
};

export const websiteJsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL };

export const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: "Invoice management, payment tracking and respectful payment reminders.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free plan" },
};

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
});

export const faqJsonLd = (items: FaqItem[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
