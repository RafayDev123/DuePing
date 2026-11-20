import { route } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { exportClientsCsv } from "@/services/clients";

export const GET = route({ limit: { max: 20, windowSec: 600 } }, async ({ ctx }) => {
  const data = await exportClientsCsv(ctx.ws.id);
  const cols = ["name", "business_name", "email", "phone", "country", "billing_address", "tax_id", "language", "preferred_channel", "created"].map((k) => ({ key: k, label: k }));
  return new Response(toCsv(cols, data), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="clients.csv"', "cache-control": "no-store" } });
});
