import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, todayInTz } from "@/lib/dates";
import { one, rows, sql } from "@/lib/sql";
import { createClient } from "@/services/clients";
import { changeDueDate, closeInvoice, createInvoice, getInvoice } from "@/services/invoices";
import { correctPayment, recordPayment, reversePayment } from "@/services/payments";
import { createPortalLink, reportPayment, resolvePortal, revokePortalLinks } from "@/services/portal";
import { listSchedules, syncInvoiceSchedules } from "@/services/reminders";
import { processDueReminders } from "@/services/worker";
import { createWorkspace, deleteWorkspace, getSettings } from "@/services/workspace";

const suffix = Math.random().toString(36).slice(2, 8);
let userA = "", userB = "", wsA = "", wsB = "", clientA = "", tz = "UTC", today = "";
const input = (clientId: string, over: Record<string, unknown> = {}) => ({
  clientId, title: null, number: null, currency: "USD", issueDate: today, dueDate: addDays(today, 10),
  items: [{ description: "Work", quantity: "1", unitPrice: "500" }], discountType: "none" as const, discountValue: "0", taxRate: "0",
  paymentTerms: null, notes: null, internalNotes: "PRIVATE", status: "sent" as const, ...over,
});

beforeAll(async () => {
  const mk = async (n: string) => (await one<{ id: string }>(sql`insert into users (email, name, password_hash, email_verified_at) values (${`t-${n}-${suffix}@example.test`}, ${n}, 'x', now()) returning id`))!.id;
  userA = await mk("a"); userB = await mk("b");
  wsA = await createWorkspace(userA, "Test A"); wsB = await createWorkspace(userB, "Test B");
  tz = (await getSettings(wsA)).timezone; today = todayInTz(tz);
  clientA = (await createClient(wsA, userA, { name: "Client A", email: "a@example.test", businessName: null, phone: null, country: null, billingAddress: null, taxId: null, language: "en", preferredChannel: "email" })).id;
});

afterAll(async () => {
  for (const ws of [wsA, wsB]) if (ws) await deleteWorkspace(ws, userA);
  await rows(sql`delete from users where email like ${`t-%-${suffix}@example.test`}`);
});

describe("invoice numbering", () => {
  it("generates unique sequential numbers and rejects duplicates", async () => {
    const a = await createInvoice(wsA, userA, input(clientA, { status: "draft" }));
    const b = await createInvoice(wsA, userA, input(clientA, { status: "draft" }));
    expect(a.number).toMatch(/^DP-\d{4}-0001$/);
    expect(b.number).toMatch(/^DP-\d{4}-0002$/);
    await expect(createInvoice(wsA, userA, input(clientA, { number: a.number, status: "draft" }))).rejects.toThrow(/already exists/);
  });
  it("runs concurrent creates without duplicate numbers", async () => {
    const r = await Promise.all(Array.from({ length: 6 }, () => createInvoice(wsA, userA, input(clientA, { status: "draft" }))));
    expect(new Set(r.map((x) => x.number)).size).toBe(6);
  });
});

describe("payment ledger", () => {
  it("handles partial payments, overpayment, reversal and correction without losing history", async () => {
    const inv = await createInvoice(wsA, userA, input(clientA));
    await recordPayment(wsA, userA, { invoiceId: inv.id, amount: "150", paidAt: today, method: "bank_transfer" });
    const p2 = await recordPayment(wsA, userA, { invoiceId: inv.id, amount: "200", paidAt: today, method: "cash" });
    let d = await getInvoice(wsA, inv.id, tz);
    expect(d.invoice.balance).toBe("150.00");
    expect(d.invoice.status).toBe("partially_paid");
    await expect(recordPayment(wsA, userA, { invoiceId: inv.id, amount: "150.01", paidAt: today, method: "cash" })).rejects.toThrow(/exceeds/);
    await expect(closeInvoice(wsA, userA, inv.id, "void", "mistake")).rejects.toThrow(/Reverse them first/);

    const c = await correctPayment(wsA, userA, p2.id, { amount: "100", paidAt: today, method: "cash" }, tz);
    d = await getInvoice(wsA, inv.id, tz);
    expect(d.invoice.balance).toBe("250.00"); // 500 - 150 - 100
    expect(d.payments.map((p) => p.kind)).toEqual(["payment", "payment", "reversal", "payment"]); // nothing overwritten
    await expect(reversePayment(wsA, userA, p2.id, "again", tz)).rejects.toThrow(/already been reversed/);

    await recordPayment(wsA, userA, { invoiceId: inv.id, amount: "250", paidAt: today, method: "card" });
    d = await getInvoice(wsA, inv.id, tz);
    expect(d.invoice.status).toBe("paid");
    expect(d.invoice.balance).toBe("0.00");
    void c;
  });
  it("keeps currencies separate", async () => {
    const inv = await createInvoice(wsA, userA, input(clientA, { currency: "PKR", items: [{ description: "x", quantity: "1", unitPrice: "85000" }] }));
    await recordPayment(wsA, userA, { invoiceId: inv.id, amount: "30000", paidAt: today, method: "jazzcash" });
    const d = await getInvoice(wsA, inv.id, tz);
    expect(d.invoice.balance).toBe("55000.00");
    expect(d.payments[0].currency).toBe("PKR");
  });
});

describe("workspace isolation", () => {
  it("never returns another workspace's records", async () => {
    const inv = await createInvoice(wsA, userA, input(clientA));
    await expect(getInvoice(wsB, inv.id, tz)).rejects.toThrow(/not found/i);
    await expect(recordPayment(wsB, userB, { invoiceId: inv.id, amount: "1", paidAt: today, method: "cash" })).rejects.toThrow(/not found/i);
    await expect(createInvoice(wsB, userB, input(clientA))).rejects.toThrow(/Client not found/);
  });
});

describe("reminders", () => {
  it("schedules only when enabled, cancels on payment, revives on reversal, recalculates on due-date change, never duplicates", async () => {
    const inv = await createInvoice(wsA, userA, input(clientA, { dueDate: addDays(today, 20) }));
    expect(await listSchedules(wsA, "upcoming", inv.id)).toHaveLength(0); // automatic reminders are off by default

    await rows(sql`update business_settings set auto_reminders_enabled = true where workspace_id = ${wsA}`);
    await syncInvoiceSchedules(wsA, inv.id);
    await syncInvoiceSchedules(wsA, inv.id); // idempotent
    const first = await listSchedules(wsA, "upcoming", inv.id);
    expect(first.length).toBe(5);
    expect(new Set(first.map((s) => s.id)).size).toBe(5);

    await changeDueDate(wsA, userA, inv.id, addDays(today, 30));
    const all = await listSchedules(wsA, "all", inv.id);
    expect(all.filter((s) => s.status === "pending")).toHaveLength(5);
    expect(all.filter((s) => s.cancel_reason === "recalculated")).toHaveLength(5);

    const pay = await recordPayment(wsA, userA, { invoiceId: inv.id, amount: "500", paidAt: today, method: "cash" });
    expect((await listSchedules(wsA, "upcoming", inv.id)).length).toBe(0);
    expect((await listSchedules(wsA, "all", inv.id)).some((s) => s.cancel_reason === "paid")).toBe(true);

    await reversePayment(wsA, userA, pay.id, "bounced", tz);
    expect((await listSchedules(wsA, "upcoming", inv.id)).length).toBe(5);

    await rows(sql`update business_settings set auto_reminders_enabled = false where workspace_id = ${wsA}`);
    await syncInvoiceSchedules(wsA, inv.id);
    expect((await listSchedules(wsA, "upcoming", inv.id)).length).toBe(0);
  });

  it("worker suppresses paid/voided invoices and fails honestly without a provider", async () => {
    await rows(sql`update business_settings set auto_reminders_enabled = true, quiet_start = 0, quiet_end = 0 where workspace_id = ${wsA}`);
    const open = await createInvoice(wsA, userA, input(clientA, { dueDate: addDays(today, 5) }));
    const paid = await createInvoice(wsA, userA, input(clientA, { dueDate: addDays(today, 5) }));
    await syncInvoiceSchedules(wsA, open.id);
    await syncInvoiceSchedules(wsA, paid.id);
    // make everything due now, then pay one *without* going through the service (simulates a race)
    await rows(sql`update reminder_schedules set scheduled_at = now() - interval '1 minute' where workspace_id = ${wsA} and status = 'pending'`);
    await rows(sql`insert into payments (workspace_id, invoice_id, client_id, kind, amount, currency, paid_at, method, created_by) values (${wsA}, ${paid.id}, ${clientA}, 'payment', 500, 'USD', ${today}, 'cash', ${userA})`);
    const stats = await processDueReminders(200);
    expect(stats.claimed).toBeGreaterThan(0);
    const paidRows = await listSchedules(wsA, "all", paid.id);
    expect(paidRows.every((s) => s.status === "cancelled" && s.cancel_reason === "paid")).toBe(true);
    const openRows = await listSchedules(wsA, "all", open.id);
    expect(openRows.some((s) => s.status === "sent")).toBe(false); // no provider configured => never reported as sent
    expect(openRows.some((s) => s.status === "failed" && /not configured/i.test(s.last_error ?? ""))).toBe(true);
    const again = await processDueReminders(200); // re-running does not resend anything
    expect(again.sent ?? 0).toBe(0);
  });
});

describe("client portal", () => {
  it("stores only token hashes, hides internal notes, honours expiry and revocation, and never marks reports as paid", async () => {
    const inv = await createInvoice(wsA, userA, input(clientA));
    const link = await createPortalLink(wsA, inv.id, userA, 30, "http://x");
    const token = link.url.split("/portal/")[1];
    const stored = await one<{ token_hash: string }>(sql`select token_hash from portal_access_tokens where invoice_id = ${inv.id}`);
    expect(stored!.token_hash).not.toContain(token);

    const ok = await resolvePortal(token, `ip-${suffix}-1`, "ua");
    expect(ok.state).toBe("ok");
    expect(JSON.stringify(ok)).not.toContain("PRIVATE");
    expect((await resolvePortal("a".repeat(43), `ip-${suffix}-2`, "ua")).state).toBe("invalid");

    await reportPayment(token, `ip-${suffix}-3`, { reference: "TX-1", amount: "500" }, null);
    const d = await getInvoice(wsA, inv.id, tz);
    expect(d.invoice.status).not.toBe("paid");
    expect(d.invoice.paymentStatus).toBe("payment_reported");
    expect(d.requests[0].status).toBe("pending");

    await rows(sql`update portal_access_tokens set expires_at = now() - interval '1 hour' where invoice_id = ${inv.id}`);
    expect((await resolvePortal(token, `ip-${suffix}-4`, "ua")).state).toBe("expired");
    const t2 = (await createPortalLink(wsA, inv.id, userA, 30, "http://x")).url.split("/portal/")[1];
    await revokePortalLinks(wsA, userA, inv.id);
    expect((await resolvePortal(t2, `ip-${suffix}-5`, "ua")).state).toBe("revoked");
  });
});
