import { whatsappApiConfigured } from "@/lib/env";

/** Normalise a phone number to digits in international format (no +). Returns null if implausible. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  d = d.replace(/\+/g, "");
  if (d.startsWith("0")) return null; // local format: country code unknown, never guess
  return d.length >= 8 && d.length <= 15 ? d : null;
}

/** Official WhatsApp click-to-chat link with prefilled text. The business owner reviews and sends manually. */
export function clickToChatLink(phone: string | null | undefined, text: string): string | null {
  const n = normalizePhone(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/**
 * Adapter for the official WhatsApp Business Platform (Cloud API). Only used when the operator configured
 * WHATSAPP_* variables AND the client has recorded consent. Sends an approved template message.
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  params: string[],
  language = "en",
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!whatsappApiConfigured()) return { ok: false, error: "WhatsApp Business API is not configured" };
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, error: "Client phone is not in international format" };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: language },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (res.ok && json.messages?.[0]?.id) return { ok: true, messageId: json.messages[0].id };
    return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
