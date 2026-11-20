import { describe, expect, it } from "vitest";
import { addDays, applyQuietHours, diffDays, inQuietHours, isYmd, todayInTz, zonedToUtc } from "@/lib/dates";
import { DEFAULT_TEMPLATES, escapeHtml, renderEmailHtml, renderTemplate, TEMPLATE_KEYS } from "@/lib/reminder-templates";
import { deriveStatus } from "@/lib/status";

const base = { total: "500.00", currency: "USD", today: "2026-03-10" };

describe("derived invoice status", () => {
  it("partial payments example: 500 - 150 - 200 = 150", () => {
    const d = deriveStatus({ ...base, stored: "sent", paid: "350.00", dueDate: "2026-03-20" });
    expect(d.status).toBe("partially_paid");
    expect(d.balance).toBe(BigInt(15000));
  });
  it("paid beats overdue", () => expect(deriveStatus({ ...base, stored: "sent", paid: "500.00", dueDate: "2026-01-01" }).status).toBe("paid"));
  it("overdue only after the due date", () => {
    expect(deriveStatus({ ...base, stored: "sent", paid: "0", dueDate: "2026-03-10" }).status).toBe("sent");
    expect(deriveStatus({ ...base, stored: "sent", paid: "0", dueDate: "2026-03-09" }).status).toBe("overdue");
  });
  it("void/cancelled/draft are never overridden", () => {
    for (const s of ["void", "cancelled", "draft"]) expect(deriveStatus({ ...base, stored: s, paid: "0", dueDate: "2020-01-01" }).status).toBe(s);
  });
  it("viewed, and payment-reported payment status", () => {
    expect(deriveStatus({ ...base, stored: "sent", paid: "0", dueDate: "2026-04-01", viewedAt: new Date() }).status).toBe("viewed");
    expect(deriveStatus({ ...base, stored: "sent", paid: "0", dueDate: "2026-04-01", pendingRequests: 1 }).paymentStatus).toBe("payment_reported");
    // a client report never makes an invoice paid
    expect(deriveStatus({ ...base, stored: "sent", paid: "0", dueDate: "2026-04-01", pendingRequests: 1 }).status).not.toBe("paid");
  });
});

describe("dates, timezones and quiet hours", () => {
  it("date math", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(diffDays("2026-03-01", "2026-03-08")).toBe(7);
    expect(isYmd("2026-02-30")).toBe(false);
  });
  it("today depends on timezone", () => {
    const t = new Date("2026-03-10T22:30:00Z");
    expect(todayInTz("UTC", t)).toBe("2026-03-10");
    expect(todayInTz("Asia/Karachi", t)).toBe("2026-03-11");
  });
  it("converts local wall time to UTC", () => {
    expect(zonedToUtc("2026-03-10", 9, 0, "Asia/Karachi").toISOString()).toBe("2026-03-10T04:00:00.000Z");
    expect(zonedToUtc("2026-07-01", 9, 0, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
  it("quiet hours wrap midnight and move to the end of the window", () => {
    const late = new Date("2026-03-10T17:30:00Z"); // 22:30 in Karachi
    expect(inQuietHours(late, "Asia/Karachi", 21, 8)).toBe(true);
    expect(applyQuietHours(late, "Asia/Karachi", 21, 8).toISOString()).toBe("2026-03-11T03:00:00.000Z"); // 08:00 next day
    const noon = new Date("2026-03-10T07:00:00Z"); // 12:00
    expect(applyQuietHours(noon, "Asia/Karachi", 21, 8)).toBe(noon);
  });
});

describe("reminder templates", () => {
  it("has all keys in en / ur / roman_ur and respectful wording", () => {
    for (const k of TEMPLATE_KEYS) for (const l of ["en", "ur", "roman_ur"] as const) {
      const t = DEFAULT_TEMPLATES[k][l];
      expect(t.subject.length).toBeGreaterThan(3);
      expect(t.body).toContain("{{business_name}}");
      expect(`${t.subject} ${t.body}`.toLowerCase()).not.toMatch(/legal action|lawyer|police|threat|sue /);
    }
  });
  it("renders variables and escapes HTML", () => {
    expect(renderTemplate("Hi {{client_name}}, {{unknown}}!", { client_name: "Sam" })).toBe("Hi Sam, !");
    const html = renderEmailHtml({ body: "Hello <script>alert(1)</script>", brandColor: "#236B57", businessName: "A&B" });
    expect(html).not.toContain("<script>");
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });
});
