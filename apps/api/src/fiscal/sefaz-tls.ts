import https from "node:https";
import tls from "node:tls";
import { extractPemFromPfx } from "./certificate-store.js";
import { ICP_BRASIL_V10_PEM } from "./icp-brasil-cas.js";

const SEFAZ_TIMEOUT_MS = 60_000;

/** CAs Mozilla do Node + AC Raiz ICP-Brasil v10 (+ cadeia extra do A1). */
export function sefazTrustStore(extraCaPems: string[] = []): string[] {
  return [...tls.rootCertificates, ICP_BRASIL_V10_PEM, ...extraCaPems];
}

/**
 * mTLS para a SEFAZ. Não usar `pfx` no Agent: o OpenSSL troca o trust store
 * pelos certs do PKCS#12 e a cadeia SSL da SEFAZ (ICP-Brasil) deixa de validar.
 */
export function createSefazHttpsAgent(
  pfx: Buffer,
  password: string,
): https.Agent {
  const { privateKeyPem, certPem, caPems } = extractPemFromPfx(pfx, password);
  return new https.Agent({
    key: privateKeyPem,
    cert: certPem,
    ca: sefazTrustStore(caPems),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
}

export function describeSefazTransportError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Erro de comunicação com a SEFAZ";
  if (
    /local issuer certificate|unable to verify the first certificate|self[- ]signed certificate/i.test(
      msg,
    )
  ) {
    return "Falha de TLS com a SEFAZ: a cadeia ICP-Brasil não pôde ser validada.";
  }
  return msg;
}

export function postSefazSoap(
  url: URL,
  soapBody: string,
  pfx: Buffer,
  password: string,
  soapAction?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = createSefazHttpsAgent(pfx, password);
    const contentType = soapAction
      ? `application/soap+xml; charset=utf-8; action="${soapAction}"`
      : "application/soap+xml; charset=utf-8";
    const req = https.request(
      url,
      {
        method: "POST",
        agent,
        timeout: SEFAZ_TIMEOUT_MS,
        headers: {
          "Content-Type": contentType,
          "Content-Length": Buffer.byteLength(soapBody, "utf8"),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(formatSefazHttpError(res.statusCode, text)));
            return;
          }
          resolve(text);
        });
      },
    );
    req.setTimeout(SEFAZ_TIMEOUT_MS, () => {
      req.destroy(new Error(`Timeout SEFAZ (${SEFAZ_TIMEOUT_MS}ms)`));
    });
    req.on("error", reject);
    req.write(soapBody);
    req.end();
  });
}

function formatSefazHttpError(status: number, body: string): string {
  const fault =
    /<soap:Text[^>]*>([\s\S]*?)<\/soap:Text>/i.exec(body)?.[1] ??
    /<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i.exec(body)?.[1];
  if (fault) {
    const text = fault
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return `SEFAZ HTTP ${status}: ${text.slice(0, 400)}`;
  }
  return `SEFAZ HTTP ${status}: ${body.slice(0, 500)}`;
}
