import { decryptSecret } from "@/lib/crypto";
import { one, sql } from "@/lib/sql";

export interface EmailConfig {
  provider: "resend";
  apiKey: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  verified: boolean;
  source: "workspace" | "platform";
}

export interface SendInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  retryable: boolean;
}

/** Workspace email integration (credentials encrypted at rest). Never falls back silently to the platform key. */
export async function getWorkspaceEmailConfig(workspaceId: string): Promise<EmailConfig | null> {
  const r = await one<{
    provider: string; from_email: string; from_name: string | null; reply_to: string | null; encrypted_secret: string; verified_at: Date | null;
  }>(sql`select provider, from_email, from_name, reply_to, encrypted_secret, verified_at from communication_integrations where workspace_id = ${workspaceId} and kind = 'email'`);
  if (!r) return null;
  return {
    provider: "resend",
    apiKey: decryptSecret(r.encrypted_secret),
    fromEmail: r.from_email,
    fromName: r.from_name,
    replyTo: r.reply_to,
    verified: !!r.verified_at,
    source: "workspace",
  };
}

export function getPlatformEmailConfig(): EmailConfig | null {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { provider: "resend", apiKey, fromEmail: from, fromName: "DuePing", replyTo: null, verified: true, source: "platform" };
}

/** Provider adapter: Resend. Other providers can be added by implementing the same signature. */
export async function sendEmail(cfg: EmailConfig, input: SendInput & { replyTo?: string | null }): Promise<SendResult> {
  const from = cfg.fromName ? `${cfg.fromName.replace(/[<>"]/g, "")} <${cfg.fromEmail}>` : cfg.fromEmail;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...((input.replyTo || cfg.replyTo) ? { reply_to: input.replyTo || cfg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.ok && json.id) return { ok: true, messageId: json.id, retryable: false };
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, error: `${res.status} ${json.name ?? ""} ${json.message ?? "Provider rejected the request"}`.trim(), retryable };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error", retryable: true };
  }
}

export async function sendPlatformEmail(input: SendInput): Promise<SendResult> {
  const cfg = getPlatformEmailConfig();
  if (!cfg) return { ok: false, error: "Platform email is not configured", retryable: false };
  return sendEmail(cfg, input);
}
