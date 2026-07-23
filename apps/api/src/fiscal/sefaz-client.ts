import https from "node:https";
import { onlyDigits } from "./nfe-access-key.js";
import {
  buildSoapEnvelope,
  extractSoapBody,
  parseSefazAuthorizationResponse,
  parseSefazEventResponse,
} from "./nfe-signer.js";
import {
  getAutorizacaoUrl,
  getConsultaProtocoloUrl,
  getInutilizacaoUrl,
  getRecepcaoEventoUrl,
} from "./sefaz-endpoints.js";

const AUTORIZACAO_NS =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4";
const EVENTO_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4";
const CONSULTA_NS =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4";
const INUTILIZACAO_NS =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4";

export type SefazAuthResult = {
  ok: boolean;
  rawResponse: string;
  parsed: ReturnType<typeof parseSefazAuthorizationResponse>;
  error?: string;
};

export async function authorizeNfe(input: {
  uf: string;
  homologation: boolean;
  enviNFeXml: string;
  pfx: Buffer;
  password: string;
}): Promise<SefazAuthResult> {
  const url = new URL(getAutorizacaoUrl(input.uf, input.homologation));
  const soap = buildSoapEnvelope(input.enviNFeXml, AUTORIZACAO_NS);

  try {
    const rawResponse = await postSoap(url, soap, input.pfx, input.password);
    const body = extractSoapBody(rawResponse);
    const parsed = parseSefazAuthorizationResponse(body);
    return {
      ok: parsed.success,
      rawResponse: body,
      parsed,
      error: parsed.success
        ? undefined
        : `${parsed.cStat ?? "?"}: ${parsed.xMotivo ?? "Rejeição SEFAZ"}`,
    };
  } catch (e) {
    return {
      ok: false,
      rawResponse: "",
      parsed: { success: false },
      error: e instanceof Error ? e.message : "Erro de comunicação com SEFAZ",
    };
  }
}

export type SefazEventResult = {
  ok: boolean;
  rawResponse: string;
  parsed: ReturnType<typeof parseSefazEventResponse>;
  error?: string;
};

export async function sendNfeEvento(input: {
  uf: string;
  homologation: boolean;
  envEventoXml: string;
  pfx: Buffer;
  password: string;
}): Promise<SefazEventResult> {
  const url = new URL(getRecepcaoEventoUrl(input.uf, input.homologation));
  const soap = buildSoapEnvelope(input.envEventoXml, EVENTO_NS);

  try {
    const rawResponse = await postSoap(url, soap, input.pfx, input.password);
    const body = extractSoapBody(rawResponse);
    const parsed = parseSefazEventResponse(body);
    return {
      ok: parsed.success,
      rawResponse: body,
      parsed,
      error: parsed.success
        ? undefined
        : `${parsed.cStat ?? "?"}: ${parsed.xMotivo ?? "Evento rejeitado"}`,
    };
  } catch (e) {
    return {
      ok: false,
      rawResponse: "",
      parsed: { success: false },
      error: e instanceof Error ? e.message : "Erro de comunicação com SEFAZ",
    };
  }
}

export async function consultNfeProtocolo(input: {
  uf: string;
  homologation: boolean;
  accessKey: string;
  pfx: Buffer;
  password: string;
}): Promise<SefazEventResult> {
  const chNFe = onlyDigits(input.accessKey);
  const tpAmb = input.homologation ? "2" : "1";
  const consSit =
    `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chNFe}</chNFe>` +
    `</consSitNFe>`;
  const url = new URL(getConsultaProtocoloUrl(input.uf, input.homologation));
  const soap = buildSoapEnvelope(consSit, CONSULTA_NS);

  try {
    const rawResponse = await postSoap(url, soap, input.pfx, input.password);
    const body = extractSoapBody(rawResponse);
    const parsed = parseSefazEventResponse(body);
    const cStat = parsed.cStat;
    const ok =
      cStat === "100" ||
      cStat === "101" ||
      cStat === "110" ||
      cStat === "150" ||
      cStat === "151" ||
      parsed.success;
    return {
      ok,
      rawResponse: body,
      parsed: { ...parsed, success: ok },
      error: ok
        ? undefined
        : `${cStat ?? "?"}: ${parsed.xMotivo ?? "Consulta sem sucesso"}`,
    };
  } catch (e) {
    return {
      ok: false,
      rawResponse: "",
      parsed: { success: false },
      error: e instanceof Error ? e.message : "Erro de comunicação com SEFAZ",
    };
  }
}

export async function sendNfeInutilizacao(input: {
  uf: string;
  homologation: boolean;
  inutNFeXml: string;
  pfx: Buffer;
  password: string;
}): Promise<SefazEventResult> {
  const url = new URL(getInutilizacaoUrl(input.uf, input.homologation));
  const soap = buildSoapEnvelope(input.inutNFeXml, INUTILIZACAO_NS);

  try {
    const rawResponse = await postSoap(url, soap, input.pfx, input.password);
    const body = extractSoapBody(rawResponse);
    const parsed = parseSefazEventResponse(body);
    const ok = parsed.cStat === "102" || parsed.success;
    return {
      ok,
      rawResponse: body,
      parsed: { ...parsed, success: ok },
      error: ok
        ? undefined
        : `${parsed.cStat ?? "?"}: ${parsed.xMotivo ?? "Inutilização rejeitada"}`,
    };
  } catch (e) {
    return {
      ok: false,
      rawResponse: "",
      parsed: { success: false },
      error: e instanceof Error ? e.message : "Erro de comunicação com SEFAZ",
    };
  }
}

function postSoap(
  url: URL,
  soapBody: string,
  pfx: Buffer,
  password: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
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
            reject(
              new Error(`SEFAZ HTTP ${res.statusCode}: ${text.slice(0, 500)}`),
            );
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
}
