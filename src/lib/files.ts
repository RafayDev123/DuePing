import { ApiError } from "@/lib/api";
import { sha256 } from "@/lib/crypto";

export interface CheckedUpload {
  buffer: Buffer;
  mime: string;
  filename: string;
  sha256: string;
}

const MAGIC: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "application/pdf", test: (b) => b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-" },
];

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file";
}

/**
 * Validates an uploaded file by size and by *content* (magic bytes), never by the client-supplied
 * MIME type or extension. Files are stored as opaque bytes and always served as attachments.
 */
export async function checkUpload(file: File | null | undefined, allowed: string[], maxBytes: number): Promise<CheckedUpload> {
  if (!file || typeof file === "string" || file.size === 0) throw new ApiError(422, "validation_failed", "No file received");
  if (file.size > maxBytes) throw new ApiError(413, "file_too_large", `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const hit = MAGIC.find((m) => m.test(buffer));
  if (!hit || !allowed.includes(hit.mime)) throw new ApiError(415, "unsupported_file", "Unsupported or unrecognised file type");
  if (hit.mime === "application/pdf") {
    const head = buffer.toString("latin1");
    // Reject PDFs carrying active content.
    if (/\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(head)) throw new ApiError(415, "unsafe_file", "PDF contains active or embedded content and was rejected");
  }
  return { buffer, mime: hit.mime, filename: sanitizeFilename(file.name), sha256: sha256(buffer) };
}
