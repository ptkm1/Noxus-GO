import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { createHash } from "node:crypto";
import { C14nCanonicalization } from "xml-crypto";

const C14N_ALG = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

function sha1Base64(data: string): string {
  return createHash("sha1").update(data, "utf8").digest("base64");
}

/** Canonicalização C14N 1.0 (inclusive) conforme XMLDSig / NF-e. */
function canonicalizeXml(xmlFragment: string): string {
  const doc = new DOMParser().parseFromString(xmlFragment, "text/xml");
  const root = doc.documentElement;
  if (!root) {
    throw new Error("XML inválido para canonicalização C14N");
  }
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("Falha ao parsear XML para C14N");
  }
  const c14n = new C14nCanonicalization();
  // xml-crypto tipa DOM Node do browser; @xmldom/xmldom é compatível em runtime.
  return c14n.process(root as unknown as Node, {});
}

function buildSignatureBlock(
  digestValue: string,
  referenceUri: string,
  privateKeyPem: string,
  certPem: string,
): string {
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="${C14N_ALG}"/><SignatureMethod Algorithm="${RSA_SHA1}"/><Reference URI="${referenceUri}"><Transforms><Transform Algorithm="${ENVELOPED}"/><Transform Algorithm="${C14N_ALG}"/></Transforms><DigestMethod Algorithm="${SHA1}"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  // Assina o SignedInfo já canonicalizado (exigência XMLDSig).
  const signedInfoCanonical = canonicalizeXml(signedInfo);
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const md = forge.md.sha1.create();
  md.update(signedInfoCanonical, "utf8");
  const signatureValue = forge.util.encode64(privateKey.sign(md));

  const cert = forge.pki.certificateFromPem(certPem);
  const certDer = forge.asn1
    .toDer(forge.pki.certificateToAsn1(cert))
    .getBytes();
  const certB64 = forge.util.encode64(certDer).replace(/\r?\n/g, "");

  return `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
}

export function signInfNFe(
  infNFeXml: string,
  privateKeyPem: string,
  certPem: string,
): string {
  const canonical = canonicalizeXml(infNFeXml);
  const digestValue = sha1Base64(canonical);
  const idMatch = /Id="([^"]+)"/.exec(infNFeXml);
  const referenceUri = idMatch ? `#${idMatch[1]}` : "";
  const signatureBlock = buildSignatureBlock(
    digestValue,
    referenceUri,
    privateKeyPem,
    certPem,
  );
  return `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFeXml}${signatureBlock}</NFe>`;
}

function signXmlBlock(
  xmlBlock: string,
  privateKeyPem: string,
  certPem: string,
  wrapperTag: string,
): string {
  const canonical = canonicalizeXml(xmlBlock);
  const digestValue = sha1Base64(canonical);
  const idMatch = /Id="([^"]+)"/.exec(xmlBlock);
  const referenceUri = idMatch ? `#${idMatch[1]}` : "";
  const signatureBlock = buildSignatureBlock(
    digestValue,
    referenceUri,
    privateKeyPem,
    certPem,
  );
  return `<${wrapperTag} versao="1.00">${xmlBlock}${signatureBlock}</${wrapperTag}>`;
}

export function signInfEvento(
  infEventoXml: string,
  privateKeyPem: string,
  certPem: string,
): string {
  return signXmlBlock(infEventoXml, privateKeyPem, certPem, "evento");
}

export function parseSefazAuthorizationResponse(xml: string): {
  success: boolean;
  cStat?: string;
  xMotivo?: string;
  nProt?: string;
  chNFe?: string;
} {
  const cStat = tag(xml, "cStat");
  const xMotivo = tag(xml, "xMotivo");
  const nProt = tag(xml, "nProt");
  const chNFe = tag(xml, "chNFe");
  const success = cStat === "100" || cStat === "104";
  return {
    success,
    cStat: cStat ?? undefined,
    xMotivo: xMotivo ?? undefined,
    nProt: nProt ?? undefined,
    chNFe: chNFe ?? undefined,
  };
}

export function parseSefazEventResponse(xml: string): {
  success: boolean;
  cStat?: string;
  xMotivo?: string;
  nProt?: string;
  chNFe?: string;
} {
  const cStat = tag(xml, "cStat");
  const xMotivo = tag(xml, "xMotivo");
  const nProt = tag(xml, "nProt");
  const chNFe = tag(xml, "chNFe");
  const success = cStat === "135" || cStat === "155" || cStat === "101";
  return {
    success,
    cStat: cStat ?? undefined,
    xMotivo: xMotivo ?? undefined,
    nProt: nProt ?? undefined,
    chNFe: chNFe ?? undefined,
  };
}

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([^<]*)</${name}>`, "i");
  return re.exec(xml)?.[1]?.trim() ?? null;
}

export function buildSoapEnvelope(
  bodyInnerXml: string,
  wsdlNs: string,
): string {
  const escaped = bodyInnerXml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="${wsdlNs}">${escaped}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

export function extractSoapBody(xml: string): string {
  const match = /<nfeResultMsg[^>]*>([\s\S]*?)<\/nfeResultMsg>/i.exec(xml);
  if (!match?.[1]) return xml;
  return match[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}
