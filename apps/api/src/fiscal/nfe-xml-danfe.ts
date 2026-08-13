/** Parser de NF-e para geração de DANFE (saída e entrada). */

export type DanfeParty = {
  document: string;
  name: string;
  ie?: string;
  phone?: string;
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
};

export type DanfeItem = {
  lineNumber: number;
  productCode?: string;
  /** GTIN / cEAN quando informado (exibe sob a descrição no DANFE). */
  barcode?: string;
  description: string;
  ncm?: string;
  csosn?: string;
  cfop?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  icmsBase?: number;
  icmsValue?: number;
  icmsRate?: number;
};

export type DanfeNfeData = {
  accessKey: string;
  number: number;
  series: number;
  model: string;
  tpNF: "0" | "1";
  issuedAt: Date | null;
  exitAt?: Date | null;
  environment: "HOMOLOGATION" | "PRODUCTION";
  nature?: string;
  emitter: DanfeParty;
  recipient: DanfeParty;
  items: DanfeItem[];
  totalProducts: number;
  totalNfe: number;
  icmsBase?: number;
  icmsValue?: number;
  icmsStBase?: number;
  icmsStValue?: number;
  freight?: number;
  insurance?: number;
  discount?: number;
  otherExpenses?: number;
  ipi?: number;
  additionalInfo?: string;
  protocol?: string;
  protocolDate?: Date | null;
  cancelled: boolean;
  freightMode?: string;
  transporterName?: string;
  transporterDocument?: string;
  transporterIe?: string;
  transporterAddress?: string;
  transporterCity?: string;
  transporterState?: string;
  vehiclePlate?: string;
  vehicleState?: string;
  anttCode?: string;
  volumeSpecies?: string;
  volumeBrand?: string;
  volumeNumbering?: string;
  grossWeight?: number;
  netWeight?: number;
  volumeQty?: number;
  /** Logo da empresa — área dedicada no canto superior esquerdo do DANFE. */
  logo?: { buffer: Buffer; mimeType: string } | null;
};

function tag(xml: string, name: string): string | undefined {
  const re = new RegExp(`<${name}>([^<]*)</${name}>`, "i");
  return re.exec(xml)?.[1]?.trim();
}

function block(xml: string, name: string): string {
  return new RegExp(`<${name}>[\\s\\S]*?</${name}>`, "i").exec(xml)?.[0] ?? "";
}

function partyFromBlock(b: string): DanfeParty {
  const document = (tag(b, "CNPJ") ?? tag(b, "CPF") ?? "").replace(/\D/g, "");
  return {
    document,
    name: tag(b, "xNome") ?? "",
    ie: tag(b, "IE"),
    phone: tag(b, "fone"),
    street: tag(b, "xLgr"),
    number: tag(b, "nro"),
    district: tag(b, "xBairro"),
    city: tag(b, "xMun"),
    state: tag(b, "UF"),
    zipCode: tag(b, "CEP"),
  };
}

function num(v: string | undefined): number {
  return Number(v ?? "0") || 0;
}

export function parseNfeXmlForDanfe(xml: string, fallback?: Partial<DanfeNfeData>): DanfeNfeData | null {
  const nfeXml =
    block(xml, "NFe") ||
    block(xml, "nfeProc") ||
    xml;

  const accessKey =
    tag(xml, "chNFe") ??
    /Id="NFe(\d{44})"/i.exec(nfeXml)?.[1] ??
    fallback?.accessKey;
  if (!accessKey || accessKey.length !== 44) return null;

  const ide = block(nfeXml, "ide");
  const emit = block(nfeXml, "emit");
  const dest = block(nfeXml, "dest");
  const total = block(nfeXml, "total");
  const icmsTot = block(total, "ICMSTot");
  const infAdic = block(nfeXml, "infAdic");
  const prot = block(xml, "protNFe") || block(xml, "infProt");
  const transp = block(nfeXml, "transp");
  const vol = block(transp, "vol");
  const transporta = block(transp, "transporta");
  const veicTransp = block(transp, "veicTransp");

  const detBlocks = nfeXml.match(/<det[\s\S]*?<\/det>/gi) ?? [];
  const items: DanfeItem[] = detBlocks.map((det, idx) => {
    const prod = block(det, "prod");
    const imposto = block(det, "imposto");
    const icms = block(imposto, "ICMS");
    const icmsChild = icms.match(/<ICMS\w+>[\s\S]*?<\/ICMS\w+>/i)?.[0] ?? icms;
    const q = Number(tag(prod, "qCom") ?? tag(prod, "qTrib") ?? "0");
    const unitPrice = Number(tag(prod, "vUnCom") ?? tag(prod, "vUnTrib") ?? "0");
    const totalPrice = Number(tag(prod, "vProd") ?? String(q * unitPrice));
    const eanRaw = tag(prod, "cEAN") ?? tag(prod, "cEANTrib") ?? "";
    const eanDigits = eanRaw.replace(/\D/g, "");
    const barcode =
      eanDigits.length >= 8 && !/^0+$/.test(eanDigits) && !/SEM\s*GTIN/i.test(eanRaw)
        ? eanDigits
        : undefined;
    return {
      lineNumber: Number(tag(det, "nItem") ?? String(idx + 1)),
      productCode: tag(prod, "cProd"),
      barcode,
      description: tag(prod, "xProd") ?? "Item",
      ncm: tag(prod, "NCM"),
      csosn: tag(icmsChild, "CSOSN") ?? tag(icmsChild, "CST"),
      cfop: tag(prod, "CFOP"),
      unit: tag(prod, "uCom") ?? tag(prod, "uTrib"),
      quantity: q,
      unitPrice,
      totalPrice,
      icmsBase: num(tag(icmsChild, "vBC")),
      icmsValue: num(tag(icmsChild, "vICMS")),
      icmsRate: num(tag(icmsChild, "pICMS")),
    };
  });

  const tpAmb = tag(ide, "tpAmb") ?? "2";
  const tpNF = (tag(ide, "tpNF") ?? "1") as "0" | "1";
  const dhEmi = tag(ide, "dhEmi") ?? tag(ide, "dEmi");
  const dhSai = tag(ide, "dhSaiEnt") ?? tag(ide, "dSaiEnt");
  const dhRecbto = tag(prot, "dhRecbto");

  const emitter = emit ? partyFromBlock(emit) : (fallback?.emitter as DanfeParty);
  const recipient = dest ? partyFromBlock(dest) : (fallback?.recipient as DanfeParty);
  if (!emitter?.name && !fallback?.emitter) return null;

  const cancelled =
    fallback?.cancelled ??
    (/Cancelamento/i.test(xml) || tag(xml, "cStat") === "101");

  return {
    accessKey,
    number: Number(tag(ide, "nNF") ?? fallback?.number ?? 0),
    series: Number(tag(ide, "serie") ?? fallback?.series ?? 0),
    model: tag(ide, "mod") ?? "55",
    tpNF,
    issuedAt: dhEmi ? new Date(dhEmi) : fallback?.issuedAt ?? null,
    exitAt: dhSai ? new Date(dhSai) : fallback?.exitAt ?? null,
    environment: tpAmb === "1" ? "PRODUCTION" : "HOMOLOGATION",
    nature: tag(ide, "natOp") ?? fallback?.nature,
    emitter: emitter ?? { document: "", name: "Emitente" },
    recipient: recipient ?? { document: "", name: "Destinatário" },
    items: items.length ? items : (fallback?.items ?? []),
    totalProducts: num(tag(icmsTot, "vProd")) || Number(tag(total, "vProd") ?? fallback?.totalProducts ?? 0),
    totalNfe: num(tag(icmsTot, "vNF")) || Number(tag(total, "vNF") ?? fallback?.totalNfe ?? 0),
    icmsBase: num(tag(icmsTot, "vBC")),
    icmsValue: num(tag(icmsTot, "vICMS")),
    icmsStBase: num(tag(icmsTot, "vBCST")),
    icmsStValue: num(tag(icmsTot, "vST")),
    freight: num(tag(icmsTot, "vFrete")),
    insurance: num(tag(icmsTot, "vSeg")),
    discount: num(tag(icmsTot, "vDesc")),
    otherExpenses: num(tag(icmsTot, "vOutro")),
    ipi: num(tag(icmsTot, "vIPI")),
    additionalInfo: tag(infAdic, "infCpl") ?? fallback?.additionalInfo,
    protocol: tag(prot, "nProt") ?? fallback?.protocol,
    protocolDate: dhRecbto ? new Date(dhRecbto) : fallback?.protocolDate ?? null,
    cancelled,
    freightMode: tag(transp, "modFrete") ?? fallback?.freightMode,
    transporterName: tag(transporta, "xNome") ?? fallback?.transporterName,
    transporterDocument:
      (tag(transporta, "CNPJ") ?? tag(transporta, "CPF") ?? "").replace(
        /\D/g,
        "",
      ) || fallback?.transporterDocument,
    transporterIe: tag(transporta, "IE") ?? fallback?.transporterIe,
    transporterAddress:
      tag(transporta, "xEnder") ?? fallback?.transporterAddress,
    transporterCity: tag(transporta, "xMun") ?? fallback?.transporterCity,
    transporterState: tag(transporta, "UF") ?? fallback?.transporterState,
    vehiclePlate: tag(veicTransp, "placa") ?? fallback?.vehiclePlate,
    vehicleState: tag(veicTransp, "UF") ?? fallback?.vehicleState,
    anttCode: tag(veicTransp, "RNTC") ?? fallback?.anttCode,
    volumeSpecies: tag(vol, "esp") ?? fallback?.volumeSpecies,
    volumeBrand: tag(vol, "marca") ?? fallback?.volumeBrand,
    volumeNumbering: tag(vol, "nVol") ?? fallback?.volumeNumbering,
    grossWeight: num(tag(vol, "pesoB")) || fallback?.grossWeight,
    netWeight: num(tag(vol, "pesoL")) || fallback?.netWeight,
    volumeQty: num(tag(vol, "qVol")) || fallback?.volumeQty,
  };
}

export function formatAccessKeyDisplay(key: string): string {
  const d = key.replace(/\D/g, "");
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
