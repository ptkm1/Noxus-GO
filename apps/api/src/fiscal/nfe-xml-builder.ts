import type {
  FiscalInvoice,
  FiscalInvoiceItem,
  OrganizationFiscalConfig,
} from "@prisma/client";
import { taxRegimeToCrt } from "./certificate-store.js";
import {
  escapeXml,
  formatNfeDecimal,
  generateAccessKey,
  onlyDigits,
} from "./nfe-access-key.js";
import { UF_IBGE } from "./sefaz-endpoints.js";

type Recipient = {
  name: string;
  document?: string | null;
  stateRegistration?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  cityIbge?: string | null;
};

/** CSOSN do Simples que no XML levam só orig + CSOSN (grupo ICMSSNxxx). */
const CSOSN_ORIG_ONLY = new Set(["102", "103", "300", "400"]);

function resolveFiscalOrigin(
  tax: Record<string, unknown>,
  lineNumber: number,
): number {
  const raw = tax.orig ?? tax.fiscalOrigin ?? tax.nfeOrigin;
  const orig = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(orig) || orig < 0 || orig > 8) {
    throw new Error(
      `Item ${lineNumber}: origem fiscal inválida (informe 0–8 no produto).`,
    );
  }
  return orig;
}

function buildIcmsXml(
  taxRegime: OrganizationFiscalConfig["taxRegime"],
  tax: Record<string, unknown>,
  lineNumber: number,
): string {
  const orig = resolveFiscalOrigin(tax, lineNumber);

  if (taxRegime === "SIMPLES_NACIONAL") {
    const csosn = String(tax.csosn ?? "102").padStart(3, "0");
    const tag = `ICMSSN${csosn}`;
    if (CSOSN_ORIG_ONLY.has(csosn)) {
      return `<ICMS>
          <${tag}>
            <orig>${orig}</orig>
            <CSOSN>${csosn}</CSOSN>
          </${tag}>
        </ICMS>`;
    }
    if (csosn === "101") {
      const pCred = formatNfeDecimal(Number(tax.pCredSN ?? tax.icmsRate ?? 0));
      const vCred = formatNfeDecimal(Number(tax.vCredICMSSN ?? tax.icms ?? 0));
      return `<ICMS>
          <ICMSSN101>
            <orig>${orig}</orig>
            <CSOSN>101</CSOSN>
            <pCredSN>${pCred}</pCredSN>
            <vCredICMSSN>${vCred}</vCredICMSSN>
          </ICMSSN101>
        </ICMS>`;
    }
    // Demais CSOSN: emite grupo genérico com campos mínimos (evita hardcode 102).
    return `<ICMS>
          <${tag}>
            <orig>${orig}</orig>
            <CSOSN>${csosn}</CSOSN>
          </${tag}>
        </ICMS>`;
  }

  const cst = String(tax.cst ?? "00").padStart(2, "0");
  const vBC = formatNfeDecimal(Number(tax.base ?? 0));
  const pICMS = formatNfeDecimal(Number(tax.icmsRate ?? 0));
  const vICMS = formatNfeDecimal(Number(tax.icms ?? 0));
  if (cst === "00") {
    return `<ICMS>
          <ICMS00>
            <orig>${orig}</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
          </ICMS00>
        </ICMS>`;
  }
  return `<ICMS>
          <ICMS${cst}>
            <orig>${orig}</orig>
            <CST>${cst}</CST>
            <modBC>3</modBC>
            <vBC>${vBC}</vBC>
            <pICMS>${pICMS}</pICMS>
            <vICMS>${vICMS}</vICMS>
          </ICMS${cst}>
        </ICMS>`;
}

export function buildSignedNfePackage(input: {
  config: OrganizationFiscalConfig;
  invoice: FiscalInvoice & { items: FiscalInvoiceItem[] };
  recipient: Recipient;
  emitterName: string;
  accessKey?: string;
  payment?: NfePaymentInfo;
}) {
  const issuedAt = new Date();
  const accessKey =
    input.accessKey ??
    generateAccessKey({
      uf: input.config.uf ?? "SP",
      issuedAt,
      cnpj: input.config.cnpj ?? "",
      series: input.invoice.series ?? input.config.nfeSeries,
      number: input.invoice.number ?? 1,
    });

  const infNFe = buildInfNFe({
    config: input.config,
    invoice: input.invoice,
    recipient: input.recipient,
    emitterName: input.emitterName,
    accessKey,
    issuedAt,
    payment: input.payment,
  });

  return { accessKey, infNFeXml: infNFe, issuedAt };
}

function buildInfNFe(input: {
  config: OrganizationFiscalConfig;
  invoice: FiscalInvoice & { items: FiscalInvoiceItem[] };
  recipient: Recipient;
  emitterName: string;
  accessKey: string;
  issuedAt: Date;
  payment?: NfePaymentInfo;
}) {
  const { config, invoice, recipient, accessKey, issuedAt, emitterName } =
    input;
  const uf = (config.uf ?? "SP").toUpperCase();
  const cUF = UF_IBGE[uf] ?? "35";
  const dhEmi = issuedAt.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const tpAmb = config.nfeEnvironment === "PRODUCTION" ? "1" : "2";
  const homolog = tpAmb === "2";
  const crt = taxRegimeToCrt(config.taxRegime);
  const destDoc = onlyDigits(recipient.document ?? "");
  const isCnpj = destDoc.length === 14;
  const total = Number(invoice.totalAmount);
  const destName = homolog
    ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"
    : recipient.name;

  const det = invoice.items
    .map((item) => {
      const tax = (item.taxSnapshot as Record<string, unknown> | null) ?? {};
      const vProd = Number(item.totalPrice);
      return `
    <det nItem="${item.lineNumber}">
      <prod>
        <cProd>${escapeXml(item.productId ?? String(item.lineNumber))}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${escapeXml(item.description)}</xProd>
        <NCM>${escapeXml((item.ncm ?? "00000000").replace(/\D/g, "").padStart(8, "0"))}</NCM>
        <CFOP>${escapeXml(item.cfop ?? "5102")}</CFOP>
        <uCom>${escapeXml(item.unit ?? "UN")}</uCom>
        <qCom>${formatNfeDecimal(Number(item.quantity), 4)}</qCom>
        <vUnCom>${formatNfeDecimal(Number(item.unitPrice))}</vUnCom>
        <vProd>${formatNfeDecimal(vProd)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${escapeXml(item.unit ?? "UN")}</uTrib>
        <qTrib>${formatNfeDecimal(Number(item.quantity), 4)}</qTrib>
        <vUnTrib>${formatNfeDecimal(Number(item.unitPrice))}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        ${buildIcmsXml(config.taxRegime, tax, item.lineNumber)}
        <PIS>
          <PISNT><CST>07</CST></PISNT>
        </PIS>
        <COFINS>
          <COFINSNT><CST>07</CST></COFINSNT>
        </COFINS>
      </imposto>
    </det>`;
    })
    .join("");

  return `<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="NFe${accessKey}" versao="4.00">
  <ide>
    <cUF>${cUF}</cUF>
    <cNF>${accessKey.slice(35, 43)}</cNF>
    <natOp>VENDA</natOp>
    <mod>55</mod>
    <serie>${invoice.series ?? config.nfeSeries}</serie>
    <nNF>${invoice.number}</nNF>
    <dhEmi>${dhEmi}</dhEmi>
    <tpNF>1</tpNF>
    <idDest>1</idDest>
    <cMunFG>${escapeXml(config.cityIbge ?? "3550308")}</cMunFG>
    <tpImp>1</tpImp>
    <tpEmis>1</tpEmis>
    <cDV>${accessKey.slice(-1)}</cDV>
    <tpAmb>${tpAmb}</tpAmb>
    <finNFe>1</finNFe>
    <indFinal>0</indFinal>
    <indPres>1</indPres>
    <procEmi>0</procEmi>
    <verProc>PEDIDOS-1.0</verProc>
  </ide>
  <emit>
    <CNPJ>${onlyDigits(config.cnpj ?? "", 14)}</CNPJ>
    <xNome>${escapeXml(emitterName)}</xNome>
    <xFant>${escapeXml(emitterName)}</xFant>
    <enderEmit>
      <xLgr>${escapeXml(config.street ?? "NAO INFORMADO")}</xLgr>
      <nro>${escapeXml(config.addressNumber ?? "S/N")}</nro>
      <xBairro>${escapeXml(config.district ?? "CENTRO")}</xBairro>
      <cMun>${escapeXml(config.cityIbge ?? "3550308")}</cMun>
      <xMun>${escapeXml(config.city ?? "SAO PAULO")}</xMun>
      <UF>${uf}</UF>
      <CEP>${onlyDigits(config.zipCode ?? "00000000", 8)}</CEP>
      <cPais>1058</cPais>
      <xPais>BRASIL</xPais>
    </enderEmit>
    <IE>${escapeXml(config.stateRegistration ?? "ISENTO")}</IE>
    <CRT>${crt}</CRT>
  </emit>
  <dest>
    <${isCnpj ? "CNPJ" : "CPF"}>${onlyDigits(destDoc, isCnpj ? 14 : 11)}</${isCnpj ? "CNPJ" : "CPF"}>
    <xNome>${escapeXml(destName)}</xNome>
    <enderDest>
      <xLgr>${escapeXml(recipient.street ?? "NAO INFORMADO")}</xLgr>
      <nro>${escapeXml(recipient.addressNumber ?? "S/N")}</nro>
      <xBairro>${escapeXml(recipient.district ?? "CENTRO")}</xBairro>
      <cMun>${escapeXml(recipient.cityIbge ?? config.cityIbge ?? "3550308")}</cMun>
      <xMun>${escapeXml(recipient.city ?? "SAO PAULO")}</xMun>
      <UF>${escapeXml(recipient.state ?? uf)}</UF>
      <CEP>${onlyDigits(recipient.zipCode ?? "00000000", 8)}</CEP>
      <cPais>1058</cPais>
      <xPais>BRASIL</xPais>
    </enderDest>
    <indIEDest>9</indIEDest>
  </dest>${det}
  <total>
    <ICMSTot>
      <vBC>0.00</vBC>
      <vICMS>0.00</vICMS>
      <vICMSDeson>0.00</vICMSDeson>
      <vFCP>0.00</vFCP>
      <vBCST>0.00</vBCST>
      <vST>0.00</vST>
      <vFCPST>0.00</vFCPST>
      <vFCPSTRet>0.00</vFCPSTRet>
      <vProd>${formatNfeDecimal(total)}</vProd>
      <vFrete>0.00</vFrete>
      <vSeg>0.00</vSeg>
      <vDesc>0.00</vDesc>
      <vII>0.00</vII>
      <vIPI>0.00</vIPI>
      <vIPIDevol>0.00</vIPIDevol>
      <vPIS>0.00</vPIS>
      <vCOFINS>0.00</vCOFINS>
      <vOutro>0.00</vOutro>
      <vNF>${formatNfeDecimal(total)}</vNF>
    </ICMSTot>
  </total>
  <transp><modFrete>9</modFrete></transp>
  ${buildPagXml(total, input.payment)}
</infNFe>`;
}

export type NfePaymentInfo = {
  /** Prazo em dias (0 = à vista). Derivado de PaymentCondition.days do pedido. */
  days: number;
  /** Código tPag NF-e (opcional; default: 01 à vista / 15 boleto a prazo). */
  tPag?: string;
};

function buildPagXml(total: number, payment?: NfePaymentInfo): string {
  const days = payment?.days ?? 0;
  // indPag: 0=à vista, 1=a prazo
  const indPag = days > 0 ? "1" : "0";
  // tPag: 01=Dinheiro; 15=Boleto Bancário; 99=Outros
  const tPag = payment?.tPag ?? (days > 0 ? "15" : "01");
  return `<pag><detPag><indPag>${indPag}</indPag><tPag>${tPag}</tPag><vPag>${formatNfeDecimal(total)}</vPag></detPag></pag>`;
}

export function wrapEnviNFe(signedNFeXml: string, idLote = "1"): string {
  return `<?xml version="1.0" encoding="UTF-8"?><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${signedNFeXml}</enviNFe>`;
}
