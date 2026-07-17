const MAX_LOGO_BYTES = 512 * 1024;

const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export function normalizeLogoMimeType(mimeType: string): string | null {
  const m = mimeType.toLowerCase().split(";")[0]!.trim();
  if (m === "image/jpg") return "image/jpeg";
  return ALLOWED_LOGO_MIME.has(m) ? m : null;
}

export function parseLogoUpload(imageBase64: string, mimeType: string): { buffer: Buffer; mimeType: string } | null {
  const normalized = normalizeLogoMimeType(mimeType);
  if (!normalized) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, "base64");
  } catch {
    return null;
  }
  if (!buffer.length || buffer.length > MAX_LOGO_BYTES) return null;
  return { buffer, mimeType: normalized };
}

export function pdfKitLogoMime(mimeType: string): "image/png" | "image/jpeg" | null {
  if (mimeType === "image/png" || mimeType === "image/gif" || mimeType === "image/webp") return "image/png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "image/jpeg";
  return null;
}
