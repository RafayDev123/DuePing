import { route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { renderInvoicePdf } from "@/lib/pdf";
import { buildInvoicePdfData } from "@/services/pdf-data";

export const GET = route({ limit: { max: 60, windowSec: 60 } }, async ({ ctx, params, req }) => {
  const data = await buildInvoicePdfData(ctx.ws.id, params.id);
  const bytes = await renderInvoicePdf(data);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  await audit(ctx.ws.id, ctx.user.id, "invoice.pdf_downloaded", "invoice", params.id);
  const name = data.invoice.number.replace(/[^\w.-]/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
});
