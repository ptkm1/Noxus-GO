/** Códigos IBGE UF (2 dígitos) para chave NF-e. */
export const UF_IBGE: Record<string, string> = {
  AC: "12",
  AL: "27",
  AM: "13",
  AP: "16",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MG: "31",
  MS: "50",
  MT: "51",
  PA: "15",
  PB: "25",
  PE: "26",
  PI: "22",
  PR: "41",
  RJ: "33",
  RN: "24",
  RO: "11",
  RR: "14",
  RS: "43",
  SC: "42",
  SE: "28",
  SP: "35",
  TO: "17",
};

/** Estados que usam SVRS para autorização NF-e. */
const SVRS_STATES = new Set([
  "AC", "AL", "AP", "DF", "ES", "MG", "PA", "PB", "PI", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "TO",
]);

export function getAutorizacaoUrl(uf: string, homologation: boolean): string {
  const u = uf.toUpperCase();
  if (u === "SP") {
    return homologation
      ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx"
      : "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx";
  }
  if (u === "MG") {
    return homologation
      ? "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4"
      : "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4";
  }
  if (u === "PR") {
    return homologation
      ? "https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeAutorizacao4"
      : "https://nfe.fazenda.pr.gov.br/nfe/NFeAutorizacao4";
  }
  if (SVRS_STATES.has(u) || u === "MA" || u === "MS" || u === "MT") {
    return homologation
      ? "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx"
      : "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx";
  }
  return homologation
    ? "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx"
    : "https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx";
}

export function getDistribuicaoDfeUrl(homologation: boolean): string {
  return homologation
    ? "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
    : "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
}

export function getRecepcaoEventoUrl(uf: string, homologation: boolean): string {
  const u = uf.toUpperCase();
  if (u === "SP") {
    return homologation
      ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx"
      : "https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx";
  }
  if (u === "MG") {
    return homologation
      ? "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4"
      : "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4";
  }
  if (u === "PR") {
    return homologation
      ? "https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeRecepcaoEvento4"
      : "https://nfe.fazenda.pr.gov.br/nfe/NFeRecepcaoEvento4";
  }
  return homologation
    ? "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx"
    : "https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx";
}
