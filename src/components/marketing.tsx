import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/controls";
import { Logo } from "@/components/ui";
import { MobileMenu } from "@/components/mobile-menu";
import { NAV_LINKS, SITE_URL, type FaqItem } from "@/lib/site";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line" style={{ background: "color-mix(in srgb, var(--bg) 92%, transparent)", backdropFilter: "blur(8px)" }}>
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="DuePing home"><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => <Link key={l.href} href={l.href} className="text-[14px] font-medium text-muted hover:text-ink">{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">Sign in</Link>
          <Link href="/signup" className="btn btn-primary hidden sm:inline-flex">Start free</Link>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const cols: [string, [string, string][]][] = [
    ["Product", [["/features", "Features"], ["/invoice-management", "Invoice management"], ["/payment-tracking", "Payment tracking"], ["/payment-reminders", "Payment reminders"], ["/whatsapp-follow-ups", "WhatsApp follow-ups"], ["/pricing", "Pricing"]]],
    ["Learn", [["/blog", "Guides"], ["/help", "Help center"], ["/faq", "FAQ"]]],
    ["Company", [["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms"]]],
  ];
  return (
    <footer className="mt-24 border-t border-line" style={{ background: "var(--nav)", color: "#b8c6bf" }}>
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div><Logo light /><p className="mt-3 max-w-xs text-[13.5px]">Invoice tracking, payment records and respectful reminders. DuePing tracks payments — it does not process or hold money.</p></div>
        {cols.map(([h, links]) => (
          <nav key={h} aria-label={h}><p className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-wider text-white">{h}</p><ul className="m-0 list-none space-y-2 p-0">{links.map(([href, l]) => <li key={href}><Link href={href} className="text-[13.5px] hover:text-white">{l}</Link></li>)}</ul></nav>
        ))}
      </div>
      <p className="m-0 border-t border-white/10 px-4 py-4 text-center text-[12px]">© {new Date().getFullYear()} DuePing · {SITE_URL.replace(/^https?:\/\//, "")}</p>
    </footer>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-muted">
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((c, i) => <li key={i}>{c.href ? <Link href={c.href} className="hover:underline">{c.label}</Link> : <span aria-current="page">{c.label}</span>}{i < items.length - 1 && <span className="ml-1.5">/</span>}</li>)}
      </ol>
    </nav>
  );
}

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold"><h3 className="m-0 text-[15px] font-semibold">{f.q}</h3><span aria-hidden className="text-muted group-open:rotate-45" style={{ transition: "transform .15s" }}>+</span></summary>
          <p className="mb-0 mt-2 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title = "Spend less time chasing payments.", sub = "Create your first invoice in a couple of minutes. No card required.", children }: { title?: string; sub?: string; children?: ReactNode }) {
  return (
    <section className="mx-auto mt-20 max-w-[1120px] px-4">
      <div className="rounded-xl px-6 py-12 text-center sm:px-12" style={{ background: "var(--nav)", color: "#fff" }}>
        <h2 className="m-0 text-[28px] font-semibold">{title}</h2>
        <p className="mx-auto mb-6 mt-2 max-w-lg" style={{ color: "#b8c6bf" }}>{sub}</p>
        <div className="flex flex-wrap justify-center gap-3">{children ?? <><Link href="/signup" className="btn" style={{ background: "#fff", color: "#15221e", borderColor: "#fff" }}>Start managing invoices</Link><Link href="/features" className="btn" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>Explore features</Link></>}</div>
      </div>
    </section>
  );
}
