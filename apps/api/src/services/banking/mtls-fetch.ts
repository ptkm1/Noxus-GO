import https from "node:https";
import { URL } from "node:url";

export type MtlsFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer | null;
  /** PEM do certificado cliente (mTLS). */
  certPem?: string | null;
  /** PEM da chave privada (mTLS). */
  keyPem?: string | null;
  timeoutMs?: number;
};

export type MtlsFetchResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Fetch com mTLS opcional via https.Agent (Node).
 * Usado por Itaú (obrigatório) e Santander quando CERT_PEM/KEY_PEM existem.
 */
export function mtlsFetch(
  url: string,
  options: MtlsFetchOptions = {},
): Promise<MtlsFetchResponse> {
  const parsed = new URL(url);
  const method = (options.method ?? "GET").toUpperCase();
  const headers = { ...(options.headers ?? {}) };
  const body = options.body ?? null;
  if (body != null && !headers["Content-Length"] && !headers["content-length"]) {
    headers["Content-Length"] = String(Buffer.byteLength(body));
  }

  const agent =
    options.certPem && options.keyPem
      ? new https.Agent({
          cert: options.certPem,
          key: options.keyPem,
          keepAlive: false,
        })
      : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        agent,
        timeout: options.timeoutMs ?? 60_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const status = res.statusCode ?? 0;
          const headerMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headerMap[k.toLowerCase()] = v;
            else if (Array.isArray(v) && v[0]) headerMap[k.toLowerCase()] = v[0];
          }
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: headerMap,
            text: async () => buf.toString("utf8"),
            json: async () => JSON.parse(buf.toString("utf8") || "null"),
            arrayBuffer: async () =>
              buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`mtlsFetch timeout: ${url}`));
    });
    if (body != null) req.write(body);
    req.end();
  });
}
