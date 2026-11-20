import { ApiError, notFound } from "@/lib/api";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { getWorkspaceEmailConfig, sendEmail, type EmailConfig, type SendResult } from "@/lib/email";
import { getBaseUrl } from "@/lib/env";
import { one, rows, sql } from "@/lib/sql";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { renderEmailHtml } from "@/lib/reminder-templates";
import { getInvoice, markSent } from "@/services/invoices";
import { createPortalLink } from "@/services/portal";
import { composeMessage, resyncWorkspace } from "@/services/reminders";
import { getSettings } from "@/services/workspace";

export async function getEmailIntegration(wsId: string) {
  const r = await one<{ provider: string; from_email: string; from_name: string | null; reply_to: string | null; verified_at: Date | null; last_test_at: Date | null; last_error: string | null }>(
    sql`select provider, from_email, from_name, reply_to, verified_at, last_test_at, last_error from communication_integrations where workspace_id = ${wsId} and kind = 'email'`,
  );
  return r;
}

export async function saveEmailIntegration(wsId: string, userId: string, input: { apiKey?: string | null; fromEmail: string; fromName?: string | null; replyTo?: string | null }) {
  const existing = await one<{ encrypted_secret: string; from_email: string }>(sql`select encrypted_secret, from_email from communication_integrations where workspace_id = ${wsId} and kind = 'email'`);
  if (!existing && !input.apiKey) throw new ApiError(422, "validation_failed", "An API key is required");
  const secret = input.apiKey ? encryptSecret(input.apiKey) : existing!.encrypted_secret;
  const changed = !existing || !!input.apiKey || existing.from_email !== input.fromEmail;
  await rows(sql`insert into communication_integrations (workspace_id, kind, provider, from_email, from_name, reply_to, encrypted_secret)
    values (${wsId}, 'email', 'resend', ${input.fromEmail}, ${input.fromName ?? null}, ${input.replyTo ?? null}, ${secret})
    on conflict (workspace_id, kind) do update set from_email = excluded.from_email, from_name = excluded.from_name, reply_to = excluded.reply_to, encrypted_secret = excluded.encrypted_secret,
      verified_at = ${changed ? sql`null` : sql`communication_integrations.verified_at`}, last_error = null`);
  await audit(wsId, userId, "integration.email_saved", "integration", "email", { from: input.fromEmail, keyChanged: !!input.apiKey });
}

export async function removeEmailIntegration(wsId: string, userId: string) {
  await rows(sql`delete from communication_integrations where workspace_id = ${wsId} and kind = 'email'`);
  await rows(sql`update business_settings set auto_reminders_enabled = false where workspace_id = ${wsId}`);
  await rows(sql`update reminder_schedules set status = 'cancelled', cancel_reason = 'auto_disabled' where workspace_id = ${wsId} and status in ('pending','paused')`);
  await audit(wsId, userId, "integration.email_removed", "integration", "email");
}

/** Sends through the provider and records the real response in email_deliveries. 'accepted' ≠ 'delivered'. */
export async function deliverEmail(
  wsId: string,
  cfg: EmailConfig,
  m: { to: string; subject: string; text: string; html: string; kind: "reminder" | "invoice" | "test" | "confirmation"; invoiceId?: string | null; scheduleId?: string | null; idempotencyKey?: string },
): Promise<SendResult & { deliveryId: string }> {
  const d = await one<{ id: string }>(sql`insert into email_deliveries (workspace_id, invoice_id, schedule_id, kind, to_email, subject, provider) values
    (${wsId}, ${m.invoiceId ?? null}, ${m.scheduleId ?? null}, ${m.kind}, ${m.to}, ${m.subject}, ${cfg.provider}) returning id`);
  const res = await sendEmail(cfg, { to: m.to, subject: m.subject, text: m.text, html: m.html, idempotencyKey: m.idempotencyKey });
  await rows(sql`update email_deliveries set status = ${res.ok ? "accepted" : "failed"}, provider_message_id = ${res.messageId ?? null}, error = ${res.error ?? null}, updated_at = now() where id = ${d!.id}`);
  return { ...res, deliveryId: d!.id };
}

/** Sends a test email to the signed-in user. Success verifies the sending identity (provider accepted the message). */
export async function testEmailIntegration(wsId: string, userId: string, to: string) {
  const cfg = await getWorkspaceEmailConfig(wsId);
  if (!cfg) throw new ApiError(409, "not_configured", "Configure an email provider first");
  const s = await getSettings(wsId);
  const subject = `DuePing test email from ${s.businessName}`;
  const text = `This is a test message sent from DuePing for ${s.businessName}.\n\nIf you received it, your sender identity works.`;
  const res = await deliverEmail(wsId, cfg, { to, subject, text, html: renderEmailHtml({ body: text, brandColor: s.brandColor, businessName: s.businessName }), kind: "test" });
  if (res.ok) {
    await rows(sql`update communication_integrations set verified_at = now(), last_test_at = now(), last_error = null where workspace_id = ${wsId} and kind = 'email'`);
  } else {
    await rows(sql`update communication_integrations set verified_at = null, last_test_at = now(), last_error = ${res.error ?? "Unknown error"} where workspace_id = ${wsId} and kind = 'email'`);
    throw new ApiError(502, "provider_error", `Provider rejected the test: ${res.error}`);
  }
  await audit(wsId, userId, "integration.email_verified", "integration", "email");
  return { messageId: res.messageId };
}

/** Test-send a reminder template (sample data) to yourself. */
export async function testSendTemplate(wsId: string, userId: string, to: string, key: string, language: string) {
  const cfg = await getWorkspaceEmailConfig(wsId);
  if (!cfg) throw new ApiError(409, "not_configured", "Configure an email provider first");
  const s = await getSettings(wsId);
  const m = await composeMessage(wsId, s, key, language, { clientName: "Sample Client", invoiceNumber: "DP-SAMPLE-0001", currency: s.defaultCurrency, balance: "250.00", total: "500.00", dueDate: new Date().toISOString().slice(0, 10), daysOverdue: 3, link: `${await getBaseUrl()}/portal/sample-link-not-valid` });
  const res = await deliverEmail(wsId, cfg, { to, subject: `[TEST] ${m.subject}`, text: m.text, html: m.html, kind: "test" });
  if (!res.ok) throw new ApiError(502, "provider_error", `Provider rejected the message: ${res.error}`);
  return { messageId: res.messageId };
}

/** Emails an invoice link to the client. Marks the invoice as sent only when the provider accepted the message. */
export async function sendInvoiceEmail(wsId: string, userId: string, invoiceId: string, opts: { to?: string | null; message?: string | null }) {
  const s = await getSettings(wsId);
  const cfg = await getWorkspaceEmailConfig(wsId);
  if (!cfg) throw new ApiError(409, "not_configured", "Email sending is not configured. Set up a provider in Settings → Email, or copy the invoice link and send it yourself.");
  const d = await getInvoice(wsId, invoiceId, s.timezone);
  if (d.invoice.status === "void" || d.invoice.status === "cancelled") throw new ApiError(409, "invalid_state", "Void or cancelled invoices cannot be sent");
  const to = opts.to || d.client.email;
  if (!to) throw new ApiError(422, "validation_failed", "This client has no email address");
  if (d.invoice.storedStatus === "draft") await markSent(wsId, userId, invoiceId);
  const link = await createPortalLink(wsId, invoiceId, userId, 60, await getBaseUrl());
  const subject = `Invoice ${d.invoice.number} from ${s.businessName}`;
  const text = `Hello ${d.client.name},\n\n${opts.message?.trim() ? opts.message.trim() + "\n\n" : ""}${s.businessName} has sent you invoice ${d.invoice.number} for ${formatMoney(d.invoice.total, d.invoice.currency)}, due on ${formatDate(d.invoice.dueDate)}.\n\nView and download it here: ${link.url}\n\nThank you,\n${s.businessName}`;
  const html = renderEmailHtml({ body: text.replace(link.url, "").replace(/\n{3,}/g, "\n\n"), brandColor: s.brandColor, businessName: s.businessName, footer: s.invoiceFooter, link: link.url });
  const res = await deliverEmail(wsId, cfg, { to, subject, text, html, kind: "invoice", invoiceId });
  await audit(wsId, userId, res.ok ? "invoice.emailed" : "invoice.email_failed", "invoice", invoiceId, { to, error: res.error });
  if (!res.ok) throw new ApiError(502, "provider_error", `The provider did not accept the email: ${res.error}`);
  return { messageId: res.messageId, status: "accepted" };
}

export async function whatsappPrepare(wsId: string, userId: string, invoiceId: string, templateKey: string) {
  const s = await getSettings(wsId);
  const d = await getInvoice(wsId, invoiceId, s.timezone);
  if (d.invoice.storedStatus !== "sent") throw new ApiError(409, "invalid_state", "Mark the invoice as sent before following up");
  const { clickToChatLink, normalizePhone } = await import("@/lib/whatsapp");
  if (!normalizePhone(d.client.phone)) throw new ApiError(422, "validation_failed", "Add the client's phone number in international format (e.g. +923001234567)");
  const link = await createPortalLink(wsId, invoiceId, userId, 60, await getBaseUrl());
  const lang = d.client.language;
  const m = await composeMessage(wsId, s, templateKey, lang, { clientName: d.client.name, invoiceNumber: d.invoice.number, currency: d.invoice.currency, balance: d.invoice.balance, total: d.invoice.total, dueDate: d.invoice.dueDate, daysOverdue: d.invoice.daysOverdue, link: link.url });
  const url = clickToChatLink(d.client.phone, m.text);
  if (!url) throw notFound("Phone number");
  await rows(sql`insert into messaging_deliveries (workspace_id, invoice_id, client_id, channel, mode, status, detail, created_by) values (${wsId}, ${invoiceId}, ${d.client.id}, 'whatsapp', 'click_to_chat', 'link_opened', ${templateKey}, ${userId})`);
  await audit(wsId, userId, "whatsapp.link_prepared", "invoice", invoiceId);
  return { url, preview: m.text };
}

export async function messagingHistory(wsId: string, invoiceId: string) {
  const emails = await rows<{ id: string; kind: string; to_email: string; subject: string; status: string; error: string | null; created_at: Date }>(sql`select id, kind, to_email, subject, status, error, created_at from email_deliveries where workspace_id = ${wsId} and invoice_id = ${invoiceId} order by created_at desc limit 30`);
  const wa = await rows<{ id: string; status: string; mode: string; created_at: Date }>(sql`select id, status, mode, created_at from messaging_deliveries where workspace_id = ${wsId} and invoice_id = ${invoiceId} order by created_at desc limit 30`);
  return { emails, whatsapp: wa };
}

export { resyncWorkspace };
