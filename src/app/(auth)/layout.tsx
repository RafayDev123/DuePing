import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_44%]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" aria-label="DuePing home"><Logo /></Link>
        <main id="main" className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</main>
        <p className="m-0 text-[12px] text-muted">© {new Date().getFullYear()} DuePing · <Link className="link" href="/privacy">Privacy</Link> · <Link className="link" href="/terms">Terms</Link></p>
      </div>
      <aside className="hidden flex-col justify-between p-12 text-white lg:flex" style={{ background: "var(--nav)" }} aria-hidden>
        <p className="m-0 font-display text-[28px] font-semibold leading-snug tracking-tight">Know what&apos;s due.<br />Never miss a payment.</p>
        <ul className="m-0 list-none space-y-3 p-0 text-[14px]" style={{ color: "#b8c6bf" }}>
          <li>◦ Partial payments tracked in an append-only ledger</li>
          <li>◦ Reminders that wait for your explicit go-ahead</li>
          <li>◦ Private client links that expire and can be revoked</li>
          <li>◦ DuePing tracks payments — it never moves your money</li>
        </ul>
      </aside>
    </div>
  );
}
