import { addDays, todayInTz } from "@/lib/dates";
import { one, rows, sql } from "@/lib/sql";
import { createClient } from "@/services/clients";
import { createInvoice } from "@/services/invoices";
import { recordPayment } from "@/services/payments";
import { getSettings } from "@/services/workspace";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api";

/** Creates clearly-labelled demo records ([Demo] prefix + is_demo flag). Removable in one click. */
export async function loadDemoData(wsId: string, userId: string) {
  const exists = await one(sql`select 1 from clients where workspace_id = ${wsId} and is_demo limit 1`);
  if (exists) throw new ApiError(409, "already_loaded", "Demo data is already loaded");
  const s = await getSettings(wsId);
  const today = todayInTz(s.timezone);
  const mk = (name: string, business: string, email: string, cur: string, lang = "en") => createClient(wsId, userId, { name: `[Demo] ${name}`, businessName: business, email, phone: "+14155550123", country: cur === "PKR" ? "Pakistan" : "United States", billingAddress: null, taxId: null, language: lang as "en", preferredChannel: "email" });
  const [acme, northwind, lahore] = await Promise.all([
    mk("Ava Martin", "Acme Studio", "demo-ava@example.com", "USD"),
    mk("Noah Kim", "Northwind Labs", "demo-noah@example.com", "USD"),
    mk("Hira Siddiqui", "Lahore Traders", "demo-hira@example.com", "PKR", "roman_ur"),
  ]);
  const base = { title: null, number: null, discountType: "none" as const, discountValue: "0", taxRate: "0", paymentTerms: "Payment due by the due date.", notes: "Demo invoice — not real data.", internalNotes: "DEMO", status: "sent" as const };
  const make = async (clientId: string, currency: string, issue: number, due: number, items: [string, string, string][], extra: Partial<{ discountType: "percent"; discountValue: string; taxRate: string }> = {}) =>
    createInvoice(wsId, userId, { ...base, ...extra, clientId, currency, issueDate: addDays(today, issue), dueDate: addDays(today, due), items: items.map(([description, quantity, unitPrice]) => ({ description, quantity, unitPrice })) }, { isDemo: true });

  const a = await make(acme.id, "USD", -40, -26, [["Brand identity design", "1", "500"]]);
  await recordPayment(wsId, userId, { invoiceId: a.id, amount: "500", paidAt: addDays(today, -20), method: "bank_transfer", reference: "DEMO-TRX-1001" });
  const b = await make(acme.id, "USD", -20, -6, [["Website build — milestone 1", "1", "350"], ["Hosting setup", "2", "75"]], { taxRate: "5" });
  await recordPayment(wsId, userId, { invoiceId: b.id, amount: "150", paidAt: addDays(today, -10), method: "paypal", reference: "DEMO-PP-77" });
  await make(northwind.id, "USD", -5, 9, [["Monthly retainer", "1", "1200"]], { discountType: "percent", discountValue: "10" });
  await make(northwind.id, "USD", -3, 2, [["SEO audit", "1", "640"]]);
  const c = await make(lahore.id, "PKR", -30, -12, [["Social media management", "1", "85000"]]);
  await recordPayment(wsId, userId, { invoiceId: c.id, amount: "30000", paidAt: addDays(today, -8), method: "jazzcash", reference: "DEMO-JC-5521" });
  await createInvoice(wsId, userId, { ...base, status: "draft", clientId: lahore.id, currency: "PKR", issueDate: today, dueDate: addDays(today, 14), items: [{ description: "Content calendar", quantity: "1", unitPrice: "45000" }] }, { isDemo: true });
  await audit(wsId, userId, "demo.loaded", "workspace", wsId);
}

export async function removeDemoData(wsId: string, userId: string) {
  const inv = sql`select id from invoices where workspace_id = ${wsId} and is_demo`;
  await rows(sql`delete from payment_verification_requests where invoice_id in (${inv})`);
  await rows(sql`delete from payments where workspace_id = ${wsId} and invoice_id in (${inv})`);
  await rows(sql`delete from reminder_schedules where workspace_id = ${wsId} and invoice_id in (${inv})`);
  await rows(sql`delete from invoices where workspace_id = ${wsId} and is_demo`);
  await rows(sql`delete from clients where workspace_id = ${wsId} and is_demo`);
  await audit(wsId, userId, "demo.removed", "workspace", wsId);
}
