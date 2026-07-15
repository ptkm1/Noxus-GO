/**
 * XML NF-e provisório a partir de pedido confirmado.
 * TODO futuro: autorização SEFAZ / certificado digital.
 */
import { prisma } from "../../db.js";
import { decToNum } from "../../util/money.js";

export class NfeXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NfeXmlError";
  }
}

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

function orderCode(order: {
  id: string;
  orderNumber: number | null;
  createdAt: Date;
}): string {
  if (order.orderNumber != null) return String(order.orderNumber);
  return order.id.slice(0, 8).toUpperCase();
}

/** Número provisório da NF a partir do orderNumber ou hash estável do id. */
function provisionalNnf(order: {
  id: string;
  orderNumber: number | null;
}): number {
  if (order.orderNumber != null && order.orderNumber > 0) {
    return order.orderNumber;
  }
  let hash = 0;
  for (let i = 0; i < order.id.length; i++) {
    hash = (hash * 31 + order.id.charCodeAt(i)) >>> 0;
  }
  return hash % 999_999_999 || 1;
}

export async function buildNfeXml(
  organizationId: string,
  orderId: string,
): Promise<{ xml: string; filename: string }> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, organizationId },
    include: {
      organization: true,
      customer: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              barcode: true,
              ncm: true,
              nfeOrigin: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) throw new NfeXmlError("Pedido não encontrado.");
  if (order.status !== "CONFIRMED") {
    throw new NfeXmlError("Somente pedidos confirmados geram XML NF-e.");
  }

  const org = order.organization;
  const customer = order.customer;
  const emitName = org.displayName?.trim() || org.name;
  const emitCnpj = onlyDigits(org.cnpj) || "00000000000000";
  const emitIe = org.stateRegistration?.trim() || "ISENTO";

  const destName =
    customer?.legalName?.trim() ||
    customer?.tradeName?.trim() ||
    customer?.name ||
    "CONSUMIDOR";
  const destDoc =
    onlyDigits(customer?.cnpj) || onlyDigits(customer?.cpf) || "00000000000";
  const destIe = customer?.stateRegistration?.trim() || "ISENTO";

  const nNF = provisionalNnf(order);
  const dhEmi = order.createdAt.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const code = orderCode(order);

  let vProd = 0;
  const detXml = order.items
    .map((it, idx) => {
      const qCom = it.quantity;
      const vUnCom = decToNum(it.unitPrice);
      const vItem = qCom * vUnCom;
      vProd += vItem;
      const ncm = (it.product.ncm ?? "00000000")
        .replace(/\D/g, "")
        .padEnd(8, "0")
        .slice(0, 8);
      const orig = it.product.nfeOrigin ?? 0;
      const cProd =
        it.product.sku || it.product.barcode || it.productId.slice(0, 8);
      return `    <det nItem="${idx + 1}">
      <prod>
        <cProd>${esc(cProd)}</cProd>
        <cEAN>${esc(it.product.barcode || "SEM GTIN")}</cEAN>
        <xProd>${esc(it.productName || it.product.name)}</xProd>
        <NCM>${esc(ncm)}</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>${qCom}.0000</qCom>
        <vUnCom>${fmtMoney(vUnCom)}</vUnCom>
        <vProd>${fmtMoney(vItem)}</vProd>
        <cEANTrib>${esc(it.product.barcode || "SEM GTIN")}</cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>${qCom}.0000</qTrib>
        <vUnTrib>${fmtMoney(vUnCom)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>${orig}</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>0.00</vBC>
            <pICMS>0.00</pICMS>
            <vICMS>0.00</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- TODO futuro: autorização SEFAZ / certificado digital — XML provisório gerado a partir do pedido ${esc(code)} -->
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${esc(emitCnpj)}${String(nNF).padStart(9, "0")}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${String(nNF).padStart(8, "0").slice(0, 8)}</cNF>
      <natOp>VENDA</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>${nNF}</nNF>
      <dhEmi>${esc(dhEmi)}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>0</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>Pedidos-provisorio-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${esc(emitCnpj)}</CNPJ>
      <xNome>${esc(emitName)}</xNome>
      <IE>${esc(emitIe)}</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      ${destDoc.length === 14 ? `<CNPJ>${esc(destDoc)}</CNPJ>` : `<CPF>${esc(destDoc.padStart(11, "0").slice(0, 11))}</CPF>`}
      <xNome>${esc(destName)}</xNome>
      <IE>${esc(destIe)}</IE>
      <indIEDest>9</indIEDest>
      ${
        customer?.street
          ? `<enderDest>
        <xLgr>${esc(customer.street)}</xLgr>
        <nro>${esc(customer.number || "S/N")}</nro>
        <xBairro>${esc(customer.neighborhood || "CENTRO")}</xBairro>
        <cMun>${esc(customer.cityIbgeCode || "3550308")}</cMun>
        <xMun>${esc(customer.city || "SAO PAULO")}</xMun>
        <UF>${esc(customer.state || "SP")}</UF>
        <CEP>${esc(onlyDigits(customer.cep) || "00000000")}</CEP>
      </enderDest>`
          : ""
      }
    </dest>
${detXml}
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
        <vProd>${fmtMoney(vProd)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${fmtMoney(decToNum(order.totalAmount))}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>
`;

  return { xml, filename: `nfe-${code}.xml` };
}

export async function listFiscalOrders(
  organizationId: string,
  filters: { from?: string; to?: string } = {},
) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (filters.from) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.from);
    if (m) {
      createdAt.gte = new Date(
        Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0),
      );
    }
  }
  if (filters.to) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filters.to);
    if (m) {
      createdAt.lte = new Date(
        Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999),
      );
    }
  }

  const rows = await prisma.order.findMany({
    where: {
      organizationId,
      status: "CONFIRMED",
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { id: true, name: true, tradeName: true } },
      seller: { include: { user: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
  });

  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    code: orderCode(o),
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    customerName: o.customer?.tradeName || o.customer?.name || "—",
    sellerName: o.seller.user.name,
    itemCount: o._count.items,
  }));
}
