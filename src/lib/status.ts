import { diffDays } from "@/lib/dates";
import { toMinor } from "@/lib/money";

export type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "cancelled" | "void";
export type PaymentStatus = "unpaid" | "partially_paid" | "fully_paid" | "overdue" | "payment_reported" | "under_review";

export interface StatusInput {
  stored: string; // draft | sent | cancelled | void
  total: string;
  paid: string;
  currency: string;
  dueDate: string;
  today: string;
  viewedAt?: Date | string | null;
  pendingRequests?: number;
  reviewRequests?: number;
}

export interface Derived {
  status: InvoiceStatus;
  paymentStatus: PaymentStatus | null;
  balance: bigint;
  daysOverdue: number;
}

/**
 * Single source of truth for derived statuses (mirrored by SQL in services/invoices.ts).
 * Stored status only holds the lifecycle decision (draft/sent/cancelled/void); everything else
 * is derived from the payment ledger and dates so contradictory states are impossible.
 */
export function deriveStatus(i: StatusInput): Derived {
  const total = toMinor(i.total, i.currency);
  const paid = toMinor(i.paid, i.currency);
  const balance = total - paid;
  const daysOverdue = Math.max(0, diffDays(i.dueDate, i.today));
  const zero = BigInt(0);

  if (i.stored === "void" || i.stored === "cancelled" || i.stored === "draft") {
    return { status: i.stored as InvoiceStatus, paymentStatus: null, balance, daysOverdue: 0 };
  }

  let status: InvoiceStatus;
  if (total > zero && balance <= zero) status = "paid";
  else if (daysOverdue > 0) status = "overdue";
  else if (paid > zero) status = "partially_paid";
  else if (i.viewedAt) status = "viewed";
  else status = "sent";

  let paymentStatus: PaymentStatus;
  if (status === "paid") paymentStatus = "fully_paid";
  else if ((i.reviewRequests ?? 0) > 0) paymentStatus = "under_review";
  else if ((i.pendingRequests ?? 0) > 0) paymentStatus = "payment_reported";
  else if (paid > zero) paymentStatus = "partially_paid";
  else if (daysOverdue > 0) paymentStatus = "overdue";
  else paymentStatus = "unpaid";

  return { status, paymentStatus, balance, daysOverdue: status === "overdue" ? daysOverdue : 0 };
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  void: "Void",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  fully_paid: "Fully paid",
  overdue: "Overdue",
  payment_reported: "Payment reported",
  under_review: "Under review",
};

/** SQL CASE expression that mirrors deriveStatus. Expects aliases i (invoices) and p.paid. */
export const DERIVED_STATUS_SQL = (todayParam: string) => `
  (case
    when i.status in ('void','cancelled','draft') then i.status
    when i.total > 0 and coalesce(p.paid,0) >= i.total then 'paid'
    when i.due_date < '${todayParam}'::date then 'overdue'
    when coalesce(p.paid,0) > 0 then 'partially_paid'
    when i.viewed_at is not null then 'viewed'
    else 'sent' end)`;
