import { describe, expect, it } from "vitest";
import { computeTotals, formatInvoiceNumber, validateNumberFormat } from "@/lib/invoicing";
import { currencyDecimals, divRound, fromMinor, normalizeAmount, parseScaled, sumByCurrency, toMinor } from "@/lib/money";

describe("money", () => {
  it("parses decimals exactly (no float drift)", () => {
    expect(toMinor("0.1", "USD") + toMinor("0.2", "USD")).toBe(toMinor("0.3", "USD"));
    expect(fromMinor(toMinor("1234.5", "USD"), "USD")).toBe("1234.50");
    expect(parseScaled("19.999", 2)).toBe(BigInt(2000));
  });
  it("respects currency decimals", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("KWD")).toBe(3);
    expect(normalizeAmount("500.0000", "USD")).toBe("500.00");
    expect(normalizeAmount("1000", "JPY")).toBe("1000");
  });
  it("rounds half away from zero", () => {
    expect(divRound(BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(divRound(BigInt(-5), BigInt(2))).toBe(BigInt(-3));
  });
  it("never mixes currencies when summing", () => {
    const out = sumByCurrency([{ currency: "USD", amount: "10.10" }, { currency: "PKR", amount: "500" }, { currency: "USD", amount: "0.20" }]);
    expect(out).toEqual({ USD: "10.30", PKR: "500.00" });
  });
  it("rejects garbage", () => {
    expect(() => parseScaled("12abc", 2)).toThrow();
  });
});

describe("invoice totals", () => {
  it("computes subtotal, percent discount, tax and total", () => {
    const t = computeTotals({ currency: "USD", items: [{ description: "a", quantity: "2", unitPrice: "100" }, { description: "b", quantity: "1.5", unitPrice: "33.33" }], discountType: "percent", discountValue: "10", taxRate: "5" });
    expect(t.lines).toEqual(["200.00", "50.00"]); // 1.5 * 33.33 = 49.995 -> 50.00
    expect(t.subtotal).toBe("250.00");
    expect(t.discountTotal).toBe("25.00");
    expect(t.taxTotal).toBe("11.25");
    expect(t.total).toBe("236.25");
  });
  it("caps fixed discounts at the subtotal", () => {
    const t = computeTotals({ currency: "USD", items: [{ description: "a", quantity: "1", unitPrice: "40" }], discountType: "fixed", discountValue: "100", taxRate: "0" });
    expect(t.total).toBe("0.00");
  });
  it("handles zero-decimal currencies", () => {
    const t = computeTotals({ currency: "JPY", items: [{ description: "a", quantity: "3", unitPrice: "333" }], discountType: "none", discountValue: "0", taxRate: "10" });
    expect(t.total).toBe("1099");
  });
  it("generates configurable invoice numbers", () => {
    expect(formatInvoiceNumber("DP-{YYYY}-{NNNN}", 2026, 1)).toBe("DP-2026-0001");
    expect(formatInvoiceNumber("INV{YY}/{NNN}", 2026, 42)).toBe("INV26/042");
    expect(validateNumberFormat("DP-{YYYY}")).toMatch(/sequence/);
    expect(validateNumberFormat("DP-{YYYY}-{NNNN}")).toBeNull();
  });
});
