import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { ApiError, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { fromMinor, toMinor } from "@/lib/money";
import { inList, likeEscape, one, rows, sql } from "@/lib/sql";
import type { ClientInput } from "@/lib/validation";
import { cancelClientSchedules } from "@/services/reminders";

export type Client = typeof clients.$inferSelect;

export interface ClientListRow {
  id: string;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  archived_at: Date | null;
  reminders_paused: boolean;
  is_demo: boolean;
  created_at: Date;
  invoice_count: number;
  outstanding: { currency: string; amount: string }[];
}

export async function listClients(wsId: string, f: { q?: string; filter?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 20);
  const where = [sql`c.workspace_id = ${wsId}`];
  if (f.filter === "archived") where.push(sql`c.archived_at is not null`);
  else where.push(sql`c.archived_at is null`);
  if (f.filter === "paused") where.push(sql`c.reminders_paused`);
  if (f.filter === "whatsapp") where.push(sql`c.preferred_channel = 'whatsapp'`);
  if (f.filter === "owes") where.push(sql`exists (select 1 from invoices i left join (select invoice_id, sum(amount) paid from payments group by invoice_id) p on p.invoice_id = i.id where i.client_id = c.id and i.status = 'sent' and i.total - coalesce(p.paid,0) > 0)`);
  if (f.q?.trim()) {
    const like = `%${likeEscape(f.q.trim())}%`;
    where.push(sql`(c.name ilike ${like} or c.business_name ilike ${like} or c.email ilike ${like} or c.phone ilike ${like})`);
  }
  const w = sql.join(where, sql` and `);
  const total = (await one<{ n: number }>(sql`select count(*)::int as n from clients c where ${w}`))!.n;
  const list = await rows<Omit<ClientListRow, "outstanding">>(sql`
    select c.id, c.name, c.business_name, c.email, c.phone, c.country, c.archived_at, c.reminders_paused, c.is_demo, c.created_at,
      (select count(*)::int from invoices i where i.client_id = c.id) as invoice_count
    from clients c where ${w} order by c.name asc limit ${pageSize} offset ${(page - 1) * pageSize}`);
  const ids = list.map((c) => c.id);
  const bal = ids.length ? await outstandingByClient(wsId, ids) : [];
  return {
    total,
    page,
    pageSize,
    rows: list.map((c) => ({ ...c, outstanding: bal.filter((b) => b.client_id === c.id).map((b) => ({ currency: b.currency, amount: b.amount })) })),
  };
}

export async function outstandingByClient(wsId: string, clientIds: string[]) {
  const r = await rows<{ client_id: string; currency: string; bal: string }>(sql`
    select i.client_id, i.currency, sum(i.total - coalesce(p.paid,0)) as bal
    from invoices i left join (select invoice_id, sum(amount) paid from payments where workspace_id = ${wsId} group by invoice_id) p on p.invoice_id = i.id
    where i.workspace_id = ${wsId} and i.status = 'sent' and i.archived_at is null and i.client_id in (${inList(clientIds)})
    group by i.client_id, i.currency having sum(i.total - coalesce(p.paid,0)) > 0`);
  return r.map((x) => ({ client_id: x.client_id, currency: x.currency, amount: fromMinor(toMinor(x.bal, x.currency), x.currency) }));
}

export async function getClient(wsId: string, id: string): Promise<Client> {
  const [c] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.workspaceId, wsId)));
  if (!c) throw notFound("Client");
  return c;
}

export async function createClient(wsId: string, userId: string, input: ClientInput) {
  const [c] = await db
    .insert(clients)
    .values({
      workspaceId: wsId,
      name: input.name,
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      billingAddress: input.billingAddress,
      taxId: input.taxId,
      language: input.language,
      preferredChannel: input.preferredChannel,
      whatsappConsentAt: input.whatsappConsent ? new Date() : null,
    })
    .returning();
  await audit(wsId, userId, "client.created", "client", c.id, { name: c.name });
  return c;
}

export async function updateClient(wsId: string, userId: string, id: string, input: Partial<ClientInput>) {
  const existing = await getClient(wsId, id);
  const patch: Partial<typeof clients.$inferInsert> = {};
  for (const k of ["name", "businessName", "email", "phone", "country", "billingAddress", "taxId", "language", "preferredChannel", "remindersPaused"] as const) {
    if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k];
  }
  if (input.whatsappConsent !== undefined) patch.whatsappConsentAt = input.whatsappConsent ? (existing.whatsappConsentAt ?? new Date()) : null;
  if (Object.keys(patch).length === 0) throw new ApiError(400, "bad_request", "Nothing to update");
  const [c] = await db.update(clients).set(patch).where(and(eq(clients.id, id), eq(clients.workspaceId, wsId))).returning();
  if (input.remindersPaused === true) await cancelClientSchedules(wsId, id, "client_paused");
  await audit(wsId, userId, "client.updated", "client", id, { fields: Object.keys(patch) });
  return c;
}

export async function archiveClient(wsId: string, userId: string, id: string, archived = true) {
  await getClient(wsId, id);
  await rows(sql`update clients set archived_at = ${archived ? sql`now()` : sql`null`} where id = ${id} and workspace_id = ${wsId}`);
  if (archived) await cancelClientSchedules(wsId, id, "client_archived");
  await audit(wsId, userId, archived ? "client.archived" : "client.restored", "client", id);
}

export async function addNote(wsId: string, userId: string, clientId: string, body: string) {
  await getClient(wsId, clientId);
  const n = await one(sql`insert into client_notes (workspace_id, client_id, author_id, body) values (${wsId}, ${clientId}, ${userId}, ${body}) returning id`);
  await audit(wsId, userId, "client.note_added", "client", clientId);
  return n;
}

export async function listNotes(wsId: string, clientId: string) {
  return rows<{ id: string; body: string; created_at: Date; author: string | null }>(sql`
    select n.id, n.body, n.created_at, u.name as author from client_notes n left join users u on u.id = n.author_id
    where n.workspace_id = ${wsId} and n.client_id = ${clientId} order by n.created_at desc`);
}

export async function clientsForSelect(wsId: string) {
  return rows<{ id: string; name: string; business_name: string | null; email: string | null }>(sql`
    select id, name, business_name, email from clients where workspace_id = ${wsId} and archived_at is null order by name asc limit 1000`);
}

export async function clientHistory(wsId: string, clientId: string) {
  const payments = await rows<{ id: string; amount: string; currency: string; paid_at: string; method: string; kind: string; reference: string | null; invoice_number: string; invoice_id: string }>(sql`
    select p.id, p.amount, p.currency, p.paid_at, p.method, p.kind, p.reference, i.number as invoice_number, i.id as invoice_id
    from payments p join invoices i on i.id = p.invoice_id where p.workspace_id = ${wsId} and p.client_id = ${clientId} order by p.paid_at desc, p.created_at desc limit 100`);
  const outstanding = await outstandingByClient(wsId, [clientId]);
  return { payments, outstanding };
}

export async function exportClientsCsv(wsId: string) {
  const r = await rows<Record<string, string | null>>(sql`
    select name, business_name, email, phone, country, billing_address, tax_id, language, preferred_channel, created_at::date::text as created
    from clients where workspace_id = ${wsId} and archived_at is null order by name`);
  return r;
}
