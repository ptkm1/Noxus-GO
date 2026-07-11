import { UF_IBGE } from "./sefaz-endpoints.js";
import { escapeXml, onlyDigits } from "./nfe-access-key.js";

export function buildCancelamentoEvento(input: {
  accessKey: string;
  cnpj: string;
  uf: string;
  homologation: boolean;
  protocol: string;
  justification: string;
  seqEvento?: number;
}) {
  const chNFe = onlyDigits(input.accessKey);
  const cnpj = onlyDigits(input.cnpj).padStart(14, "0").slice(0, 14);
  const cOrgao = UF_IBGE[input.uf.toUpperCase()] ?? "35";
  const tpAmb = input.homologation ? "2" : "1";
  const nSeq = String(input.seqEvento ?? 1).padStart(2, "0");
  const tpEvento = "110111";
  const id = `ID${tpEvento}${chNFe}${nSeq}`;
  const dhEvento = new Date().toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const xJust = escapeXml(input.justification.trim());

  const infEvento = `<infEvento Id="${id}" xmlns="http://www.portalfiscal.inf.br/nfe"><cOrgao>${cOrgao}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chNFe}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${tpEvento}</tpEvento><nSeqEvento>${input.seqEvento ?? 1}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${escapeXml(input.protocol)}</nProt><xJust>${xJust}</xJust></detEvento></infEvento>`;

  return { infEvento, idLote: "1" };
}

export function wrapEnvEvento(signedEventoXml: string, idLote = "1"): string {
  return `<?xml version="1.0" encoding="UTF-8"?><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${idLote}</idLote>${signedEventoXml}</envEvento>`;
}
