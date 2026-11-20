import { describe, expect, it } from "vitest";
import { parseCsv, safeCell, toCsv } from "@/lib/csv";
import { decryptSecret, encryptSecret, hashPassword, sha256, verifyPassword } from "@/lib/crypto";
import { checkUpload } from "@/lib/files";
import { renderInvoicePdf, pdfSafe } from "@/lib/pdf";
import { extractFields, parseDate, suggestMapping } from "@/services/imports";
import { clickToChatLink, normalizePhone } from "@/lib/whatsapp";
import { can } from "@/lib/permissions";

describe("csv", () => {
  it("parses quotes, commas and newlines", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n1,2')).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["1", "2"]]);
  });
  it("neutralises formula injection on export", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("-5")).toBe("-5");
    expect(toCsv([{ key: "a", label: "A" }], [{ a: "@cmd" }])).toContain("'@cmd");
  });
});

describe("import helpers", () => {
  it("suggests column mapping", () => {
    expect(suggestMapping(["Invoice No", "Customer", "Due Date", "Amount"])).toMatchObject({ number: 0, clientName: 1, dueDate: 2, total: 3 });
  });
  it("parses date formats", () => {
    expect(parseDate("05/03/2026", "dmy")).toBe("2026-03-05");
    expect(parseDate("05/03/2026", "mdy")).toBe("2026-05-03");
    expect(parseDate("nonsense", "iso")).toBeNull();
  });
  it("extracts fields from PDF-like text (heuristic, needs review)", () => {
    const e = extractFields("Acme Studio\nInvoice No: INV-2041\nIssue Date: 2026-02-01\nDue Date: 2026-02-15\nBill To:\nJane Roe\njane@roe.com\nDesign work 2 150.00 300.00\nTotal Due: USD 300.00");
    expect(e.fields).toMatchObject({ number: "INV-2041", issueDate: "2026-02-01", dueDate: "2026-02-15", clientEmail: "jane@roe.com", currency: "USD", total: "300.00" });
    expect(e.lines[0]).toMatchObject({ description: "Design work", quantity: "2", lineTotal: "300.00" });
  });
});

describe("upload validation", () => {
  const f = (bytes: number[], name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });
  it("accepts a real PNG and rejects spoofed types", async () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
    expect((await checkUpload(f(png, "a.png", "image/png"), ["image/png"], 1000)).mime).toBe("image/png");
    await expect(checkUpload(f([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0], "evil.png", "image/png"), ["image/png"], 1000)).rejects.toThrow(/Unsupported/);
  });
  it("enforces size and rejects active PDF content", async () => {
    await expect(checkUpload(f(new Array(2000).fill(0x25), "big.pdf", "application/pdf"), ["application/pdf"], 1000)).rejects.toThrow(/too large/);
    const bad = Array.from(Buffer.from("%PDF-1.4\n/OpenAction << /S /JavaScript /JS (app.alert(1)) >>"));
    await expect(checkUpload(f(bad, "x.pdf", "application/pdf"), ["application/pdf"], 5000)).rejects.toThrow(/active/);
  });
});

describe("crypto", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("encrypts secrets round-trip and never stores plaintext", () => {
    const enc = encryptSecret("re_live_secret");
    expect(enc).not.toContain("re_live_secret");
    expect(decryptSecret(enc)).toBe("re_live_secret");
    expect(() => decryptSecret(enc.slice(0, -4) + "AAAA")).toThrow();
    expect(sha256("x")).toHaveLength(64);
  });
});

describe("pdf + whatsapp + permissions", () => {
  it("renders an invoice PDF (even with non-latin text)", async () => {
    expect(pdfSafe("حسن ₨")).toBe("??? ?"); // unsupported glyphs are replaced, never thrown
    const bytes = await renderInvoicePdf({
      business: { name: "Acme", email: null, phone: null, address: "1 Road", taxId: null, website: null, logoDataUrl: null, color: "#236B57", footer: null, paymentInstructions: "Bank: 123" },
      client: { name: "Client حسن", businessName: null, email: null, address: null, taxId: null },
      invoice: { number: "DP-2026-0001", title: null, currency: "USD", issueDate: "2026-01-01", dueDate: "2026-01-15", status: "sent", items: Array.from({ length: 40 }, (_, i) => ({ description: `Item ${i} `.repeat(8), quantity: "1", unitPrice: "10.00", lineTotal: "10.00" })), subtotal: "400.00", discountTotal: "0", discountLabel: "Discount", taxTotal: "0", taxRate: "0", total: "400.00", paid: "100.00", balance: "300.00", notes: "n", paymentTerms: "t" },
      payments: [{ date: "2026-01-05", method: "bank_transfer", amount: "100.00", kind: "payment" }],
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });
  it("builds official click-to-chat links only for international numbers", () => {
    expect(normalizePhone("+92 300 1234567")).toBe("923001234567");
    expect(normalizePhone("0300 1234567")).toBeNull();
    expect(clickToChatLink("+923001234567", "Hi there")).toBe("https://wa.me/923001234567?text=Hi%20there");
  });
  it("enforces the role matrix", () => {
    expect(can("viewer", "invoices.write")).toBe(false);
    expect(can("member", "payments.write")).toBe(false);
    expect(can("accountant", "payments.write")).toBe(true);
    expect(can("admin", "workspace.delete")).toBe(false);
    expect(can("owner", "workspace.delete")).toBe(true);
  });
});
