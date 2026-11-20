import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { notify } from "@/lib/audit";
import { one, sql } from "@/lib/sql";

const MAP: Record<string, string> = {
  "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.sent": "accepted",
};

/** Resend (Svix) signed webhook. Requires RESEND_WEBHOOK_SECRET; unsigned requests are rejected. */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: { code: "not_configured", message: "Webhook secret is not configured" } }, { status: 503 });
  const body = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  const ts = req.headers.get("svix-timestamp") ?? "";
  const sigHeader = req.headers.get("svix-signature") ?? "";
  if (!id || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return NextResponse.json({ ok: false }, { status: 400 });
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  const valid = sigHeader.split(" ").some((s) => {
    const sig = s.split(",")[1] ?? "";
    return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
  if (!valid) return NextResponse.json({ ok: false }, { status: 401 });
  let evt: { type?: string; data?: { email_id?: string } };
  try {
    evt = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const status = MAP[evt.type ?? ""];
  const mid = evt.data?.email_id;
  if (status && mid) {
    // Never downgrade a final state (delivered/bounced) back to 'accepted'.
    const upd = await one<{ id: string; workspace_id: string; invoice_id: string | null; subject: string }>(sql`update email_deliveries set status = ${status}, updated_at = now()
      where provider_message_id = ${mid} and (status in ('queued','accepted') or ${status} in ('bounced','complained')) returning id, workspace_id, invoice_id, subject`);
    if (upd && (status === "bounced" || status === "complained" || status === "failed")) {
      await notify(upd.workspace_id, "reminder_failed", `Email ${status}: ${upd.subject}`, { link: upd.invoice_id ? `/app/invoices/${upd.invoice_id}` : "/app/reminders", dedupeKey: `bounce:${upd.id}` });
    }
  }
  return NextResponse.json({ ok: true });
}
