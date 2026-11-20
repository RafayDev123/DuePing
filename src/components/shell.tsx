"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BarChart3, BellRing, Bell, ChevronsUpDown, FileText, LayoutDashboard, LogOut, Menu, Plus, Search, Settings, Upload, Users, Wallet, X, ShieldCheck, Check, HelpCircle } from "lucide-react";
import { Logo } from "@/components/ui";
import { ThemeToggle } from "@/components/controls";
import { api, errMsg } from "@/components/api-client";
import { useToast } from "@/components/toast";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  { href: "/app/clients", label: "Clients", icon: Users },
  { href: "/app/payments", label: "Payments", icon: Wallet },
  { href: "/app/reminders", label: "Reminders", icon: BellRing },
  { href: "/app/reports", label: "Reports", icon: BarChart3 },
  { href: "/app/import", label: "Import", icon: Upload },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

interface Props {
  user: { name: string; email: string; isPlatformAdmin: boolean };
  ws: { id: string; name: string };
  workspaces: { id: string; name: string; role: string }[];
  role: string;
  unread: number;
  canWrite: boolean;
  children: ReactNode;
}

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onOut(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onOut(); };
    document.addEventListener("mousedown", d);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", d); document.removeEventListener("keydown", k); };
  }, [active, ref, onOut]);
}

export function Shell({ user, ws, workspaces, role, unread, canWrite, children }: Props) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(wsRef, () => setWsOpen(false), wsOpen);
  useOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const isActive = (n: (typeof NAV)[number]) => (n.exact ? path === n.href : path.startsWith(n.href));

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3 py-2">
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = isActive(n);
        return (
          <Link key={n.href} href={n.href} onClick={() => setDrawer(false)} aria-current={active ? "page" : undefined}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors md:py-2"
            style={{ color: active ? "#fff" : "var(--nav-ink)", background: active ? "rgba(255,255,255,.09)" : "transparent", boxShadow: active ? "inset 2px 0 0 #6fcfae" : undefined }}>
            <Icon size={17} aria-hidden /> {n.label}
          </Link>
        );
      })}
      {user.isPlatformAdmin && (
        <Link href="/admin" className="mt-3 flex items-center gap-3 rounded-md px-3 py-2 text-[13px]" style={{ color: "var(--nav-ink)" }}><ShieldCheck size={16} /> Platform admin</Link>
      )}
    </nav>
  );

  async function switchWs(id: string) {
    try { await api("/api/v1/workspaces/switch", { body: { id } }); setWsOpen(false); router.push("/app"); router.refresh(); } catch (e) { toast.push("error", errMsg(e)); }
  }
  async function logout() {
    try { await api("/api/v1/auth/logout", { method: "POST", body: {} }); } finally { router.push("/login"); router.refresh(); }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[236px_1fr]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen flex-col md:flex" style={{ background: "var(--nav)" }}>
        <div className="px-5 pb-3 pt-5"><Link href="/app" aria-label="DuePing overview"><Logo light size={20} /></Link></div>
        {nav}
        <div className="border-t border-white/10 p-3">
          <Link href="/help" className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px]" style={{ color: "var(--nav-ink)" }}><HelpCircle size={15} /> Help center</Link>
          <p className="px-3 pt-2 text-[11.5px]" style={{ color: "var(--nav-ink)", opacity: 0.7 }}>Signed in as {role}</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="pop absolute left-0 top-0 flex h-full w-[272px] flex-col" style={{ background: "var(--nav)" }}>
            <div className="flex items-center justify-between px-5 py-4">
              <Logo light size={20} />
              <button className="btn btn-ghost btn-icon" style={{ color: "#fff" }} aria-label="Close navigation" onClick={() => setDrawer(false)}><X size={18} /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5" style={{ background: "color-mix(in srgb, var(--bg) 92%, transparent)", backdropFilter: "blur(8px)" }}>
          <button className="btn btn-ghost btn-icon md:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}><Menu size={19} /></button>

          <div className="relative" ref={wsRef}>
            <button className="btn btn-sm" aria-haspopup="listbox" aria-expanded={wsOpen} onClick={() => setWsOpen((o) => !o)} style={{ maxWidth: 210 }}>
              <span className="truncate">{ws.name}</span><ChevronsUpDown size={14} className="shrink-0" />
            </button>
            {wsOpen && (
              <div className="pop card absolute left-0 z-50 mt-1 w-64 overflow-hidden py-1 shadow-xl" role="listbox" aria-label="Workspaces">
                {workspaces.map((w) => (
                  <button key={w.id} role="option" aria-selected={w.id === ws.id} onClick={() => switchWs(w.id)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-[13.5px] hover:bg-[var(--neutral-soft)]">
                    <span className="truncate">{w.name}<span className="ml-2 text-[11.5px] text-muted">{w.role}</span></span>
                    {w.id === ws.id && <Check size={14} />}
                  </button>
                ))}
                <Link href="/workspaces/new" className="flex items-center gap-2 border-t border-line px-3.5 py-2 text-[13.5px] hover:bg-[var(--neutral-soft)]"><Plus size={14} /> New business workspace</Link>
              </div>
            )}
          </div>

          <form action="/app/invoices" method="get" role="search" className="mx-1 hidden max-w-md flex-1 sm:block">
            <label htmlFor="global-search" className="sr-only">Search invoices and clients</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="global-search" name="q" type="search" placeholder="Search invoices, clients…" className="input" style={{ paddingLeft: 34, minHeight: 36 }} />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/app/invoices?q=" className="btn btn-ghost btn-icon sm:hidden" aria-label="Search invoices"><Search size={18} /></Link>
            <ThemeToggle />
            <Link href="/app/notifications" className="btn btn-ghost btn-icon relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell size={18} />
              {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--danger)" }}>{unread > 9 ? "9+" : unread}</span>}
            </Link>
            {canWrite && <Link href="/app/invoices/new" className="btn btn-primary btn-sm"><Plus size={15} /><span className="hidden sm:inline">New invoice</span><span className="sm:hidden">New</span></Link>}
            <div className="relative" ref={menuRef}>
              <button className="btn btn-icon" style={{ borderRadius: 999 }} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu" onClick={() => setMenuOpen((o) => !o)}>
                <span className="text-[12.5px] font-bold">{user.name.slice(0, 1).toUpperCase()}</span>
              </button>
              {menuOpen && (
                <div className="pop card absolute right-0 z-50 mt-1 w-60 overflow-hidden py-1 shadow-xl" role="menu">
                  <div className="border-b border-line px-3.5 py-2.5"><p className="m-0 truncate text-[13.5px] font-semibold">{user.name}</p><p className="m-0 truncate text-[12px] text-muted">{user.email}</p></div>
                  <Link role="menuitem" href="/app/settings" className="flex items-center gap-2 px-3.5 py-2 text-[13.5px] hover:bg-[var(--neutral-soft)]"><Settings size={14} /> Settings</Link>
                  <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] hover:bg-[var(--neutral-soft)]"><LogOut size={14} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="print-full mx-auto w-full max-w-[1240px] px-3 pb-24 pt-5 sm:px-6 md:pb-12 md:pt-7">{children}</main>
      </div>
    </div>
  );
}
