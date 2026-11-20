"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "@/lib/site";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button className="btn btn-ghost btn-icon" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="m-menu" onClick={() => setOpen((o) => !o)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      {open && (
        <nav id="m-menu" aria-label="Mobile" className="pop absolute inset-x-0 top-full border-b border-line bg-surface px-4 py-3 shadow-lg">
          {NAV_LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-[16px] font-medium">{l.label}</Link>)}
          <div className="mt-2 flex gap-2 border-t border-line pt-3"><Link href="/login" className="btn flex-1">Sign in</Link><Link href="/signup" className="btn btn-primary flex-1">Start free</Link></div>
        </nav>
      )}
    </div>
  );
}
