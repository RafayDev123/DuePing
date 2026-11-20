import { z } from "zod";
import { ApiError, clientIp, publicRoute } from "@/lib/api";
import { checkUpload } from "@/lib/files";
import { reportPayment } from "@/services/portal";

const fields = z.object({
  amount: z.string().max(30).regex(/^\d{0,14}(\.\d{1,4})?$/, "Enter a valid amount").optional().or(z.literal("")),
  reference: z.string().max(120).optional(),
  payerName: z.string().max(120).optional(),
  message: z.string().max(1000).optional(),
});

/** Clients report a payment. This creates a *verification request*; it never marks the invoice paid. */
export const POST = publicRoute({ limit: { max: 20, windowSec: 3600 } }, async ({ req, params }) => {
  const form = await req.formData().catch(() => null);
  if (!form) throw new ApiError(400, "bad_request", "Invalid form submission");
  if (String(form.get("website") ?? "") !== "") return { id: "ok" }; // honeypot
  const parsed = fields.safeParse(Object.fromEntries(["amount", "reference", "payerName", "message"].map((k) => [k, form.get(k) ? String(form.get(k)) : undefined])));
  if (!parsed.success) throw new ApiError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid input");
  const f = form.get("file");
  const file = f instanceof File && f.size > 0 ? await checkUpload(f, ["application/pdf", "image/png", "image/jpeg"], 3 * 1024 * 1024) : null;
  return reportPayment(params.token, clientIp(req), { ...parsed.data, amount: parsed.data.amount || null }, file);
});
