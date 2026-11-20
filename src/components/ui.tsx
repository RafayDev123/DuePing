import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { STATUS_LABEL, PAYMENT_STATUS_LABEL, type InvoiceStatus, type PaymentStatus } from "@/lib/status";

const TONE: Record<InvoiceStatus, string> = {
  draft: "b-neutral", sent: "b-info", viewed: "b-info", partially_paid: "b-warning", paid: "b-success", overdue: "b-danger", cancelled: "b-neutral", void: "b-neutral",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`badge ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const PTONE: Record<PaymentStatus, string> = { unpaid: "b-neutral", partially_paid: "b-warning", fully_paid: "b-success", overdue: "b-danger", payment_reported: "b-accent", under_review: "b-info" };
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge ${PTONE[status]}`}>{PAYMENT_STATUS_LABEL[status]}</span>;
}

export function Money({ amount, currency, className = "" }: { amount: string | number; currency: string; className?: string }) {
  return <span className={`num ${className}`}>{formatMoney(amount, currency)}</span>;
}

export function PageHeader({ title, sub, actions, crumbs }: { title: string; sub?: ReactNode; actions?: ReactNode; crumbs?: { href?: string; label: string }[] }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 text-[12.5px] text-muted">
            {crumbs.map((c, i) => (
              <span key={i}>
                {c.href ? <Link href={c.href} className="hover:underline">{c.label}</Link> : c.label}
                {i < crumbs.length - 1 && <span className="mx-1.5">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="m-0 text-[22px] font-semibold leading-tight break-words">{title}</h1>
        {sub && <p className="mt-1 text-[13.5px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-accentsoft text-accenttext">{icon}</div>}
      <h3 className="m-0 text-[15px] font-semibold">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-[13.5px] text-muted">{children}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, base }: { page: number; pageSize: number; total: number; base: URLSearchParams }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="px-4 py-3 text-[12.5px] text-muted">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const q = new URLSearchParams(base);
    q.set("page", String(p));
    return `?${q.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-muted">
      <span>{from}–{to} of {total}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link className="btn btn-sm" href={href(page - 1)}>Previous</Link> : <span className="btn btn-sm" aria-disabled style={{ opacity: 0.5 }}>Previous</span>}
        {page < pages ? <Link className="btn btn-sm" href={href(page + 1)}>Next</Link> : <span className="btn btn-sm" aria-disabled style={{ opacity: 0.5 }}>Next</span>}
      </span>
    </nav>
  );
}

export function Logo({ light = false, size = 22 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-display font-bold tracking-tight" style={{ fontSize: size, color: light ? "#fff" : "var(--ink)" }}>
      <svg width={size + 4} height={size + 4} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#236B57" />
        <circle cx="16" cy="17" r="3" fill="#D8E8DF" />
        <path d="M9.5 11.5a9 9 0 0 1 13 0M6.5 8.5a13 13 0 0 1 19 0" stroke="#D8E8DF" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".85" />
      </svg>
      DuePing
    </span>
  );
}

export function SearchParamsToQuery(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v !== "" && k !== "page") q.set(k, v);
  return q;
}
