import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runWorkerCycle } from "@/services/worker";

export const dynamic = "force-dynamic";

/** Trigger one worker cycle from an external scheduler. Requires `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
  const result = await runWorkerCycle();
  return NextResponse.json({ ok: true, data: result });
}
