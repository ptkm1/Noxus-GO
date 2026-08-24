import { pdfKitLogoMime } from "../fiscal/danfe-logo.js";
import { loadFiscalDanfeLogo } from "./nfe-danfe-load.js";

const MAX_LOGO_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 3_000;

export type OrderPdfLogo = {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg";
};

function mimeFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  return ct.toLowerCase().split(";")[0]!.trim() || null;
}

function mimeFromDataUrl(header: string): string | null {
  const m = /^data:([^;,]+)/i.exec(header);
  return m?.[1]?.toLowerCase().trim() ?? null;
}

function asPdfLogo(buffer: Buffer, mimeType: string): OrderPdfLogo | null {
  if (!buffer.length || buffer.length > MAX_LOGO_BYTES) return null;
  const kit = pdfKitLogoMime(mimeType);
  if (!kit) return null;
  return { buffer, mimeType: kit };
}

async function loadFromLogoUrl(logoUrl: string): Promise<OrderPdfLogo | null> {
  const url = logoUrl.trim();
  if (!url) return null;

  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    const header = url.slice(0, comma);
    const payload = url.slice(comma + 1);
    const mime = mimeFromDataUrl(header);
    if (!mime) return null;
    try {
      const buffer = Buffer.from(
        payload,
        /;base64/i.test(header) ? "base64" : "utf8",
      );
      return asPdfLogo(buffer, mime);
    } catch {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "image/png,image/jpeg,image/webp,image/gif,*/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime =
      mimeFromContentType(res.headers.get("content-type")) ?? "image/png";
    return asPdfLogo(buf, mime);
  } catch {
    return null;
  }
}

/**
 * Prioridade: logo da organização (`logoUrl`) → logo DANFE da org → null
 * (sem logo, o PDF usa só o nome da Organization / emitente).
 */
export async function resolveOrderPdfLogo(params: {
  organizationId: string;
  logoUrl?: string | null;
}): Promise<OrderPdfLogo | null> {
  if (params.logoUrl?.trim()) {
    const fromUrl = await loadFromLogoUrl(params.logoUrl);
    if (fromUrl) return fromUrl;
  }

  const danfe = await loadFiscalDanfeLogo(params.organizationId);
  if (!danfe) return null;
  return asPdfLogo(danfe.buffer, danfe.mimeType);
}
