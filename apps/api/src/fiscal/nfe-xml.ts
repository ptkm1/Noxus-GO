/** Parser simplificado de NF-e de entrada (XML modelo 55). */

export type ParsedInboundNfe = {
  accessKey: string;
  number: number;
  series: number;
  issuedAt: Date | null;
  totalAmount: number;
  issuer: {
    cnpj: string;
    name: string;
    ie?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  items: {
    lineNumber: number;
    description: string;
    ncm?: string;
    cfop?: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    supplierProductCode?: string;
  }[];
};

function tag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}>([^<]*)</${name}>`, "i");
  return re.exec(xml)?.[1]?.trim();
}

function tags(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}>([^<]*)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]!.trim());
  return out;
}

export function parseInboundNfeXml(xml: string): ParsedInboundNfe | null {
  const accessKey =
    tag(xml, "chNFe") ??
    (() => {
      const id = /Id="NFe(\d{44})"/i.exec(xml)?.[1];
      return id;
    })();
  if (!accessKey || accessKey.length !== 44) return null;

  const detBlocks = xml.match(/<det[\s\S]*?<\/det>/gi) ?? [];
  const items = detBlocks.map((block, idx) => {
    const q = Number(tag(block, "qCom") ?? tag(block, "qTrib") ?? "0");
    const unitPrice = Number(tag(block, "vUnCom") ?? tag(block, "vUnTrib") ?? "0");
    const totalPrice = Number(tag(block, "vProd") ?? String(q * unitPrice));
    return {
      lineNumber: Number(tag(block, "nItem") ?? String(idx + 1)),
      description: tag(block, "xProd") ?? "Item",
      ncm: tag(block, "NCM"),
      cfop: tag(block, "CFOP"),
      unit: tag(block, "uCom") ?? tag(block, "uTrib"),
      quantity: q,
      unitPrice,
      totalPrice,
      supplierProductCode: tag(block, "cProd"),
    };
  });

  const emitBlock = /<emit>[\s\S]*?<\/emit>/i.exec(xml)?.[0] ?? xml;

  return {
    accessKey,
    number: Number(tag(xml, "nNF") ?? "0"),
    series: Number(tag(xml, "serie") ?? "0"),
    issuedAt: (() => {
      const dh = tag(xml, "dhEmi") ?? tag(xml, "dEmi");
      return dh ? new Date(dh) : null;
    })(),
    totalAmount: Number(tag(xml, "vNF") ?? "0"),
    issuer: {
      cnpj: (tag(emitBlock, "CNPJ") ?? tag(emitBlock, "CPF") ?? "").replace(/\D/g, ""),
      name: tag(emitBlock, "xNome") ?? "Fornecedor",
      ie: tag(emitBlock, "IE"),
      street: tag(emitBlock, "xLgr"),
      city: tag(emitBlock, "xMun"),
      state: tag(emitBlock, "UF"),
      zipCode: tag(emitBlock, "CEP"),
    },
    items,
  };
}

export function extractAccessKeysFromDfeResponse(xml: string): string[] {
  return tags(xml, "chNFe").filter((k) => k.length === 44);
}
