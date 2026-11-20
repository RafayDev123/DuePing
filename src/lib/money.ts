/**
 * Money helpers. All arithmetic is done on integers (BigInt minor units); floating
 * point is only ever used for display formatting.
 */

export const CURRENCIES = [
  "USD", "EUR", "GBP", "PKR", "AED", "SAR", "INR", "CAD", "AUD", "SGD", "CHF", "JPY", "CNY", "TRY", "BDT", "MYR", "ZAR", "NGN", "KES", "EGP", "KWD", "BHD", "QAR", "SEK", "NOK", "DKK", "NZD", "BRL", "MXN",
] as const;

const decimalsCache = new Map<string, number>();

// ISO 4217 minor units where the platform's CLDR data differs (CLDR rounds these for cash; ISO defines the real minor unit).
const ISO_MINOR_UNITS: Record<string, number> = { PKR: 2, IDR: 2, COP: 2, LBP: 2, AFN: 2, ALL: 2, RSD: 2, YER: 2, MMK: 2, MGA: 2, SOS: 2, IQD: 3 };

export function currencyDecimals(currency: string): number {
  const c = currency.toUpperCase();
  const hit = decimalsCache.get(c);
  if (hit !== undefined) return hit;
  if (c in ISO_MINOR_UNITS) {
    decimalsCache.set(c, ISO_MINOR_UNITS[c]);
    return ISO_MINOR_UNITS[c];
  }
  let d = 2;
  try {
    d = new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    d = 2;
  }
  decimalsCache.set(c, d);
  return d;
}

/** Parse a decimal string/number into a BigInt scaled by 10^scale, rounding half away from zero. */
export function parseScaled(value: string | number | null | undefined, scale: number): bigint {
  if (value === null || value === undefined || value === "") return BigInt(0);
  let s = typeof value === "number" ? value.toFixed(Math.max(scale, 8)) : String(value).trim();
  s = s.replace(/,/g, "");
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new Error(`Invalid decimal: ${String(value)}`);
  const neg = m[1] === "-";
  const int = m[2] || "0";
  const frac = m[3] ?? "";
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  let n = BigInt(int + padded);
  const rest = frac.slice(scale);
  if (rest.length > 0 && rest.charCodeAt(0) >= 53) n += BigInt(1); // '5'..'9' rounds up
  return neg ? -n : n;
}

export function formatScaled(n: bigint, scale: number): string {
  const neg = n < BigInt(0);
  const abs = neg ? -n : n;
  const s = abs.toString().padStart(scale + 1, "0");
  const int = s.slice(0, s.length - scale);
  const frac = s.slice(s.length - scale);
  return `${neg ? "-" : ""}${int}${scale > 0 ? "." + frac : ""}`;
}

export const toMinor = (v: string | number | null | undefined, currency: string) => parseScaled(v, currencyDecimals(currency));
export const fromMinor = (n: bigint, currency: string) => formatScaled(n, currencyDecimals(currency));

/** Divide with half-away-from-zero rounding. */
export function divRound(num: bigint, den: bigint): bigint {
  const zero = BigInt(0);
  const two = BigInt(2);
  const neg = num < zero !== den < zero;
  const a = num < zero ? -num : num;
  const b = den < zero ? -den : den;
  const q = (a * two + b) / (b * two);
  return neg ? -q : q;
}

/** Normalise a DB numeric string to the currency's decimals ("500.0000" -> "500.00"). */
export function normalizeAmount(v: string | number | null | undefined, currency: string): string {
  return fromMinor(toMinor(v, currency), currency);
}

export function formatMoney(amount: string | number | null | undefined, currency: string, locale = "en-US"): string {
  const n = Number(amount ?? 0);
  try {
    const d = currencyDecimals(currency);
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Sum amounts grouped by currency; never mixes currencies. */
export function sumByCurrency(rows: { currency: string; amount: string | number }[]): Record<string, string> {
  const acc: Record<string, bigint> = {};
  for (const r of rows) acc[r.currency] = (acc[r.currency] ?? BigInt(0)) + toMinor(r.amount, r.currency);
  const out: Record<string, string> = {};
  for (const [c, v] of Object.entries(acc)) out[c] = fromMinor(v, c);
  return out;
}
