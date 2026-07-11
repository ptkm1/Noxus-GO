import forge from "node-forge";
import { createHash } from "node:crypto";

function sha1Base64(data: string): string {
  return createHash("sha1").update(data, "utf8").digest("base64");
}

function canonicalizeInfNFe(infNFeXml: string): string {
  return infNFeXml.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

export function signInfNFe(infNFeXml: string, privateKeyPem: string, certPem: string): string {
  const canonical = canonicalizeInfNFe(infNFeXml);
  const digestValue = sha1Base64(canonical);
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const cert = forge.pki.certificateFromPem(certPem);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certB64 = forge.util.encode64(certDer);
  const idMatch = /Id="([^"]+)"/.exec(infNFeXml);
  const referenceUri = idMatch ? `#${idMatch[1]}` : "";

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${referenceUri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const md = forge.md.sha1.create();
  md.update(signedInfo, "utf8");
  const signature = privateKey.sign(md);
  const signatureValue = forge.util.encode64(signature);

  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64.replace(/\r?\n/g, "")}</X509Certificate></X509Data></KeyInfo></Signature>`;

  return `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFeXml}${signatureBlock}</NFe>`;
}

function canonicalizeXmlBlock(xml: string): string {
  return xml.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function signXmlBlock(xmlBlock: string, privateKeyPem: string, certPem: string, wrapperTag: string): string {
  const canonical = canonicalizeXmlBlock(xmlBlock);
  const digestValue = sha1Base64(canonical);
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const cert = forge.pki.certificateFromPem(certPem);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certB64 = forge.util.encode64(certDer);
  const idMatch = /Id="([^"]+)"/.exec(xmlBlock);
  const referenceUri = idMatch ? `#${idMatch[1]}` : "";

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="${referenceUri}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const md = forge.md.sha1.create();
  md.update(signedInfo, "utf8");
  const signature = privateKey.sign(md);
  const signatureValue = forge.util.encode64(signature);

  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64.replace(/\r?\n/g, "")}</X509Certificate></X509Data></KeyInfo></Signature>`;

  return `<${wrapperTag} versao="1.00">${xmlBlock}${signatureBlock}</${wrapperTag}>`;
}

export function signInfEvento(infEventoXml: string, privateKeyPem: string, certPem: string): string {
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
  return { success, cStat: cStat ?? undefined, xMotivo: xMotivo ?? undefined, nProt: nProt ?? undefined, chNFe: chNFe ?? undefined };
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
  return { success, cStat: cStat ?? undefined, xMotivo: xMotivo ?? undefined, nProt: nProt ?? undefined, chNFe: chNFe ?? undefined };
}

function tag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}>([^<]*)</${name}>`, "i");
  return re.exec(xml)?.[1]?.trim() ?? null;
}

export function buildSoapEnvelope(bodyInnerXml: string, wsdlNs: string): string {
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
