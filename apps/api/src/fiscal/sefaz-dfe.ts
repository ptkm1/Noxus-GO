import { getDistribuicaoDfeUrl } from "./sefaz-endpoints.js";
import { extractSoapBody } from "./nfe-signer.js";
import { escapeXml, onlyDigits } from "./nfe-access-key.js";

const DIST_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";

export type DistDfeDoc = {
  nsu: string;
  schema: string;
  xml: string;
  accessKey?: string;
};

export type DistDfeResult = {
  ok: boolean;
  cStat?: string;
  xMotivo?: string;
  ultNSU?: string;
  maxNSU?: string;
  documents: DistDfeDoc[];
  rawResponse: string;
  error?: string;
};

function tag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, "i");
  return re.exec(xml)?.[1]?.trim();
}

export function buildDistDfeConsulta(input: {
  cnpj: string;
  ufIbge: string;
  homologation: boolean;
  ultNsu?: string;
}) {
  const cnpj = onlyDigits(input.cnpj).padStart(14, "0").slice(0, 14);
  const tpAmb = input.homologation ? "2" : "1";
  const nsu = (input.ultNsu ?? "0").padStart(15, "0");
  return (
    `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<cUFAutor>${escapeXml(input.ufIbge)}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${nsu}</ultNSU></distNSU>` +
    `</distDFeInt>`
  );
}

export function parseDistDfeResponse(xml: string): DistDfeResult {
  const cStat = tag(xml, "cStat");
  const xMotivo = tag(xml, "xMotivo");
  const ultNSU = tag(xml, "ultNSU");
  const maxNSU = tag(xml, "maxNSU");
  const documents: DistDfeDoc[] = [];

  const docRe = /<docZip[^>]*NSU="(\d+)"[^>]*schema="([^"]+)"[^>]*>([^<]+)<\/docZip>/gi;
  let m: RegExpExecArray | null;
  while ((m = docRe.exec(xml))) {
    const nsu = m[1]!;
    const schema = m[2]!;
    const b64 = m[3]!.replace(/\s+/g, "");
    let decoded = "";
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
      // gzip common for DistDFe — try inflate if starts with gzip magic
      const raw = Buffer.from(b64, "base64");
      if (raw[0] === 0x1f && raw[1] === 0x8b) {
        // defer inflate to caller via zlib later; keep base64 marker
        decoded = `gzip:${b64}`;
      }
    } catch {
      decoded = "";
    }
    const accessKey =
      /Id="NFe(\d{44})"/i.exec(decoded)?.[1] ??
      tag(decoded, "chNFe") ??
      undefined;
    documents.push({ nsu, schema, xml: decoded, accessKey });
  }

  const ok = cStat === "138" || cStat === "137";
  return {
    ok,
    cStat: cStat ?? undefined,
    xMotivo: xMotivo ?? undefined,
    ultNSU: ultNSU ?? undefined,
    maxNSU: maxNSU ?? undefined,
    documents,
    rawResponse: xml,
    error: ok ? undefined : `${cStat ?? "?"}: ${xMotivo ?? "Falha DistDFe"}`,
  };
}

export async function consultDistDfe(input: {
  cnpj: string;
  ufIbge: string;
  homologation: boolean;
  ultNsu?: string;
  pfx: Buffer;
  password: string;
}): Promise<DistDfeResult> {
  const distXml = buildDistDfeConsulta(input);
  // DistDFe exige wrapper nfeDistDFeInteresse (diferente de Autorização).
  const soap =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body><nfeDistDFeInteresse xmlns="${DIST_NS}"><nfeDadosMsg>${distXml
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const url = new URL(getDistribuicaoDfeUrl(input.homologation));

  try {
    const raw = await postSoap(url, soap, input.pfx, input.password);
    const body = extractSoapBody(raw);
    const parsed = parseDistDfeResponse(body);
    // decompress gzip docs
    const { gunzipSync } = await import("node:zlib");
    for (const doc of parsed.documents) {
      if (doc.xml.startsWith("gzip:")) {
        try {
          const rawBuf = Buffer.from(doc.xml.slice(5), "base64");
          doc.xml = gunzipSync(rawBuf).toString("utf8");
          doc.accessKey =
            /Id="NFe(\d{44})"/i.exec(doc.xml)?.[1] ??
            tag(doc.xml, "chNFe") ??
            doc.accessKey;
        } catch {
          /* keep gzip marker */
        }
      }
    }
    return parsed;
  } catch (e) {
    return {
      ok: false,
      documents: [],
      rawResponse: "",
      error: e instanceof Error ? e.message : "Erro DistDFe",
    };
  }
}

function postSoap(url: URL, soapBody: string, pfx: Buffer, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    import("node:https").then(({ default: https }) => {
      const agent = new https.Agent({
        pfx,
        passphrase: password,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
      });
      const req = https.request(
        url,
        {
          method: "POST",
          agent,
          headers: {
            "Content-Type": "application/soap+xml; charset=utf-8",
            "Content-Length": Buffer.byteLength(soapBody, "utf8"),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`SEFAZ HTTP ${res.statusCode}: ${text.slice(0, 500)}`));
              return;
            }
            resolve(text);
          });
        },
      );
      req.on("error", reject);
      req.write(soapBody);
      req.end();
    });
  });
}
