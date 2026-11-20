import { route } from "@/lib/api";
import { checkUpload } from "@/lib/files";
import { extractPdf } from "@/services/imports";

/** Step 1: extract only. Nothing is saved; the user must review and confirm. */
export const POST = route({ perm: "import.run", limit: { max: 20, windowSec: 600 } }, async ({ req }) => {
  const form = await req.formData().catch(() => null);
  const f = await checkUpload(form?.get("file") as File | null, ["application/pdf"], 8 * 1024 * 1024);
  const extraction = await extractPdf(f.buffer);
  return { ...extraction, filename: f.filename, ocrAvailable: !!process.env.OCR_API_KEY };
});
