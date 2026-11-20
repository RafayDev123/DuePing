"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Moon, Sun } from "lucide-react";

/** Native <dialog> modal: built-in focus trap, Esc to close, labelled by its title. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} style={wide ? { width: "min(760px, calc(100vw - 24px))" } : undefined}>
      {open && (
        <div className="flex max-h-[calc(100vh-32px)] flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 id={id} className="m-0 text-[16px] font-semibold">{title}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">✕</button>
          </div>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Dropdown({ label = "Actions", children, icon, align = "right" }: { label?: string; children: (close: () => void) => ReactNode; icon?: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {icon ?? <MoreHorizontal size={16} />}
      </button>
      {open && (
        <div role="menu" className="pop card absolute z-50 mt-1 min-w-[200px] overflow-hidden py-1 shadow-xl" style={align === "right" ? { right: 0 } : { left: 0 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, href, children, danger, disabled }: { onClick?: () => void; href?: string; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  const cls = "flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13.5px] hover:bg-[var(--neutral-soft)] disabled:opacity-50";
  const style = danger ? { color: "var(--danger-ink)" } : undefined;
  if (href) return <a role="menuitem" href={href} className={cls} style={style}>{children}</a>;
  return <button role="menuitem" type="button" className={cls} style={style} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon ${className}`}
      aria-label="Toggle light and dark theme"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("dp-theme", next);
      }}
    >
      <Moon size={17} className="theme-moon" aria-hidden />
      <Sun size={17} className="theme-sun" aria-hidden />
    </button>
  );
}

export interface FilterField {
  name: string;
  label: string;
  type: "search" | "select" | "date";
  options?: { value: string; label: string }[];
  placeholder?: string;
  showWhen?: { name: string; value: string };
}

/** URL-driven filters: every change updates the query string, the server component re-renders with real data. */
export function FilterBar({ fields, className = "" }: { fields: FilterField[]; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, sp.get(f.name) ?? ""])));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (next: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    for (const f of fields) {
      if (next[f.name]) p.set(f.name, next[f.name]);
      else p.delete(f.name);
    }
    p.delete("page");
    router.replace(`${path}?${p.toString()}`);
  };
  const set = (name: string, value: string, debounce = false) => {
    const next = { ...q, [name]: value };
    setQ(next);
    if (timer.current) clearTimeout(timer.current);
    if (debounce) timer.current = setTimeout(() => push(next), 350);
    else push(next);
  };
  const active = fields.some((f) => q[f.name]);
  return (
    <div className={`flex flex-wrap items-end gap-2.5 ${className}`} role="search">
      {fields.map((f) => {
        if (f.showWhen && q[f.showWhen.name] !== f.showWhen.value) return null;
        const id = `f-${f.name}`;
        return (
          <div key={f.name} className={f.type === "search" ? "min-w-[200px] flex-1" : "min-w-[130px]"}>
            <label className="label" htmlFor={id} style={{ marginBottom: 3, fontWeight: 500, color: "var(--muted)" }}>{f.label}</label>
            {f.type === "select" ? (
              <select id={id} className="select" value={q[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input id={id} className="input" type={f.type === "date" ? "date" : "search"} placeholder={f.placeholder} value={q[f.name]} onChange={(e) => set(f.name, e.target.value, f.type === "search")} />
            )}
          </div>
        );
      })}
      {active && (
        <button className="btn btn-ghost btn-sm" onClick={() => { const cleared = Object.fromEntries(fields.map((f) => [f.name, ""])); setQ(cleared); push(cleared); }}>Clear</button>
      )}
    </div>
  );
}
