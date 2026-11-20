import { divRound, fromMinor, parseScaled, toMinor } from "@/lib/money";

export type DiscountType = "none" | "percent" | "fixed";

export interface ItemInput {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
}

export interface TotalsInput {
  currency: string;
  items: ItemInput[];
  discountType: DiscountType;
  discountValue: string | number;
  taxRate: string | number;
}

export interface Totals {
  lines: string[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
}

/**
 * Deterministic invoice totals using integer arithmetic.
 * line = round(qty * unitPrice); discount applies to the subtotal; tax applies to (subtotal - discount).
 */
export function computeTotals(input: TotalsInput): Totals {
  const zero = BigInt(0);
  const { currency } = input;
  const lines = input.items.map((it) => {
    const qtyMilli = parseScaled(it.quantity, 3);
    const price = toMinor(it.unitPrice, currency);
    return divRound(qtyMilli * price, BigInt(1000));
  });
  const subtotal = lines.reduce((a, b) => a + b, zero);

  let discount = zero;
  if (input.discountType === "percent") {
    const pct = parseScaled(input.discountValue, 3); // 3 decimals
    const capped = pct > BigInt(100000) ? BigInt(100000) : pct;
    discount = divRound(subtotal * capped, BigInt(100000));
  } else if (input.discountType === "fixed") {
    const fixed = toMinor(input.discountValue, currency);
    discount = fixed > subtotal ? subtotal : fixed;
  }
  if (discount < zero) discount = zero;

  const taxable = subtotal - discount;
  const rate = parseScaled(input.taxRate, 3);
  const tax = divRound(taxable * rate, BigInt(100000));
  const total = taxable + tax;

  return {
    lines: lines.map((l) => fromMinor(l, currency)),
    subtotal: fromMinor(subtotal, currency),
    discountTotal: fromMinor(discount, currency),
    taxTotal: fromMinor(tax, currency),
    total: fromMinor(total, currency),
  };
}

export function subtractAmounts(a: string, b: string, currency: string): string {
  return fromMinor(toMinor(a, currency) - toMinor(b, currency), currency);
}

export function addAmounts(a: string, b: string, currency: string): string {
  return fromMinor(toMinor(a, currency) + toMinor(b, currency), currency);
}

export function compareAmounts(a: string, b: string, currency: string): number {
  const x = toMinor(a, currency);
  const y = toMinor(b, currency);
  return x === y ? 0 : x > y ? 1 : -1;
}

/** Format number from pattern like "DP-{YYYY}-{NNNN}" (N count = zero padding). */
export function formatInvoiceNumber(pattern: string, year: number, seq: number): string {
  return pattern
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year).slice(-2))
    .replace(/\{(N+)\}/g, (_, n: string) => String(seq).padStart(n.length, "0"));
}

export function validateNumberFormat(pattern: string): string | null {
  if (!/\{N{2,8}\}/.test(pattern)) return "Format must contain a sequence token such as {NNNN}.";
  if (pattern.length > 40) return "Format is too long.";
  if (!/^[A-Za-z0-9{}\-_/. ]+$/.test(pattern)) return "Only letters, numbers and - _ / . are allowed.";
  return null;
}
