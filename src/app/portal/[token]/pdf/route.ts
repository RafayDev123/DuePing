import { NextRequest } from "next/server";
import { clientIp } from "@/lib/api";
import { renderInvoicePdf } from "@/lib/pdf";
import { buildInvoicePdfData } from "@/services/pdf-data";
import { resolvePortal } from "@/services/portal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const p = await resolvePortal(token, clientIp(req), req.headers.get("user-agent") || "", "pdf");
  if (p.state !== "ok") return new Response("This link is not available.", { status: p.state === "rate_limited" ? 429 : 404, headers: { "x-robots-tag": "noindex" } });
  const bytes = await renderInvoicePdf(await buildInvoicePdfData(p.wsId, p.invoiceId));
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${p.invoice.number.replace(/[^\w.-]/g, "_")}.pdf"`, "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" },
  });
}
