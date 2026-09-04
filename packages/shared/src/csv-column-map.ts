/**
 * Mapeamento de colunas CSV de sistemas externos → campos Pedix.
 * Headers normalizados: trim, lower, sem acento, espaços→_, só [a-z0-9_].
 */

import {
    CUSTOMER_CSV_HEADERS,
    PRODUCT_CSV_HEADERS,
    type CustomerCsvHeader,
    type ProductCsvHeader,
} from "./csv-import.js";

export type CsvImportKind = "customers" | "products";

/** targetField → sourceHeader normalizado (vazio = não mapear). */
export type CsvColumnMap = Record<string, string>;

export type CsvHeaderPeek = { raw: string; key: string };

export type CsvImportRecipe = {
  id: string;
  name: string;
  kind: CsvImportKind;
  columnMap: CsvColumnMap;
  createdAt: string;
};

export function normalizeCsvHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export const CUSTOMER_CSV_FIELD_LABELS: Record<CustomerCsvHeader, string> = {
  tipo_documento: "Tipo documento (CNPJ/CPF)",
  documento: "Documento (CNPJ ou CPF)",
  nome: "Nome (CPF)",
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  email: "E-mail",
  telefone: "Telefone",
  cep: "CEP",
  logradouro: "Logradouro",
  numero: "Número",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  codigo_ibge: "Código IBGE",
  complemento: "Complemento",
  inscricao_estadual: "Inscrição estadual",
  comprador: "Comprador / contato",
  observacoes: "Observações",
  vendedor_email: "Vendedor (e-mail ou nome)",
  limite_credito: "Limite de crédito",
};

export const PRODUCT_CSV_FIELD_LABELS: Record<ProductCsvHeader, string> = {
  nome: "Nome",
  grupo: "Grupo",
  fornecedor: "Fornecedor",
  preco: "Preço",
  sku: "SKU",
  codigo_barras: "Código de barras",
  estoque: "Estoque",
  descricao: "Descrição",
  tabela_preco: "Tabela de preço",
  ncm: "NCM",
  unidade_compra: "Unidade de compra",
  preco_custo: "Preço de custo",
  bloqueia_sem_estoque: "Bloqueia sem estoque",
};

/** Aliases normalizados por campo-alvo (além do próprio nome do campo). */
export const CUSTOMER_CSV_FIELD_ALIASES: Record<
  CustomerCsvHeader,
  readonly string[]
> = {
  tipo_documento: ["tipo", "tipo_doc", "tipodocumento", "doc_tipo"],
  documento: [
    "cpfcnpj",
    "cnpjcpf",
    "cnpj",
    "cpf",
    "cpf_cnpj",
    "cnpj_cpf",
    "documento_cliente",
    "cgc",
  ],
  nome: ["nome_completo", "cliente", "nome_cliente"],
  razao_social: ["razao", "razaosocial", "empresa", "nome_empresa"],
  nome_fantasia: ["fantasia", "nome_fantasia_comercial", "trade_name"],
  email: ["e_mail", "mail", "email_cliente", "correio"],
  telefone: ["fone", "tel", "celular", "whatsapp", "telefone_cliente"],
  cep: ["zip", "zipcode", "codigo_postal"],
  logradouro: ["endereco", "rua", "av", "avenida", "street", "address"],
  numero: ["num", "nro", "nr", "number"],
  bairro: ["distrito", "neighborhood"],
  cidade: ["municipio", "city", "localidade"],
  uf: ["estado", "state", "sigla_uf"],
  codigo_ibge: ["ibge", "cod_ibge", "codigoibge", "id_ibge"],
  complemento: ["compl", "complement"],
  inscricao_estadual: [
    "ie",
    "i_e",
    "insc_estadual",
    "inscricao",
    "rg_ie",
  ],
  comprador: ["contato", "responsavel", "buyer", "contato_cliente"],
  observacoes: ["obs", "observacao", "notes", "nota"],
  vendedor_email: [
    "vendedor",
    "seller",
    "email_vendedor",
    "vendedor_nome",
    "representante",
  ],
  limite_credito: ["limite", "credito", "credit_limit", "limite_de_credito"],
};

export const PRODUCT_CSV_FIELD_ALIASES: Record<
  ProductCsvHeader,
  readonly string[]
> = {
  nome: ["produto", "descricao_produto", "name", "item"],
  grupo: ["categoria", "grupo_produto", "category", "familia"],
  fornecedor: ["industria", "supplier", "fabricante", "marca_fornecedor"],
  preco: ["preco_venda", "valor", "price", "vl_unitario", "preco_unitario"],
  sku: ["codigo", "cod", "referencia", "ref", "code"],
  codigo_barras: ["ean", "barcode", "gtin", "cod_barras", "barra"],
  estoque: ["qtd", "quantidade", "saldo", "stock", "qtde"],
  descricao: ["obs", "detalhe", "complemento"],
  tabela_preco: ["tabela", "price_table", "lista_preco"],
  ncm: ["cod_ncm", "ncm_produto"],
  unidade_compra: ["unidade", "un", "uom", "embalagem"],
  preco_custo: ["custo", "cost", "vl_custo"],
  bloqueia_sem_estoque: ["bloqueia_estoque", "controla_estoque"],
};

function aliasesFor(
  kind: CsvImportKind,
  field: string,
): readonly string[] {
  if (kind === "customers") {
    return (
      CUSTOMER_CSV_FIELD_ALIASES[field as CustomerCsvHeader] ?? []
    );
  }
  return PRODUCT_CSV_FIELD_ALIASES[field as ProductCsvHeader] ?? [];
}

function targetFields(kind: CsvImportKind): readonly string[] {
  return kind === "customers" ? CUSTOMER_CSV_HEADERS : PRODUCT_CSV_HEADERS;
}

export function csvFieldLabel(kind: CsvImportKind, field: string): string {
  if (kind === "customers") {
    return (
      CUSTOMER_CSV_FIELD_LABELS[field as CustomerCsvHeader] ?? field
    );
  }
  return PRODUCT_CSV_FIELD_LABELS[field as ProductCsvHeader] ?? field;
}

/** Lê só a linha de cabeçalho (para UI de mapeamento). */
export function peekCsvHeaders(csvText: string): CsvHeaderPeek[] {
  const text = csvText.replace(/^\uFEFF/, "");
  let firstLine = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      firstLine += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    firstLine += ch;
  }
  if (!firstLine.trim()) return [];

  const semis = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const delimiter: ";" | "," = semis >= commas ? ";" : ",";

  const rawCells: string[] = [];
  let cur = "";
  inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]!;
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      rawCells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  rawCells.push(cur.trim());

  return rawCells
    .filter((r) => r.length > 0)
    .map((raw) => ({
      raw: raw.replace(/^"|"$/g, "").replace(/""/g, '"'),
      key: normalizeCsvHeader(raw),
    }))
    .filter((h) => h.key.length > 0);
}

/**
 * Sugere mapeamento target → sourceKey.
 * Prioriza campos “obrigatórios” e evita reutilizar a mesma coluna fonte.
 */
export function suggestCsvColumnMap(
  kind: CsvImportKind,
  sourceKeys: string[],
): CsvColumnMap {
  const sources = [...new Set(sourceKeys.map(normalizeCsvHeader).filter(Boolean))];
  const used = new Set<string>();
  const map: CsvColumnMap = {};

  const priority =
    kind === "customers"
      ? [
          "documento",
          "razao_social",
          "nome_fantasia",
          "nome",
          "email",
          "telefone",
          "cep",
          "logradouro",
          "numero",
          "bairro",
          "cidade",
          "uf",
          "codigo_ibge",
          "tipo_documento",
          "complemento",
          "inscricao_estadual",
          "comprador",
          "vendedor_email",
          "observacoes",
          "limite_credito",
        ]
      : [...PRODUCT_CSV_HEADERS];

  for (const field of priority) {
    if (!targetFields(kind).includes(field as never)) continue;
    const candidates = [field, ...aliasesFor(kind, field)].map(normalizeCsvHeader);
    const hit = candidates.find((c) => sources.includes(c) && !used.has(c));
    if (hit) {
      map[field] = hit;
      used.add(hit);
    } else {
      map[field] = "";
    }
  }

  return map;
}

export function csvColumnMapIsEmpty(map: CsvColumnMap): boolean {
  return !Object.values(map).some((v) => Boolean(v?.trim()));
}

/** Campos de cliente que aceitam valor padrão em massa na importação. */
export const CUSTOMER_CSV_BULK_FIELDS = [
  "telefone",
  "email",
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "cidade",
  "uf",
  "codigo_ibge",
  "complemento",
  "inscricao_estadual",
  "comprador",
] as const satisfies readonly CustomerCsvHeader[];

export type CustomerCsvBulkField = (typeof CUSTOMER_CSV_BULK_FIELDS)[number];

/** Pacote rápido para linhas sem endereço (revisar depois no cadastro). */
export const CUSTOMER_CSV_ADDRESS_FALLBACK: Partial<
  Record<CustomerCsvBulkField, string>
> = {
  cep: "00000000",
  logradouro: "não possui",
  numero: "S/N",
  bairro: "não possui",
  cidade: "",
  uf: "",
  complemento: "não possui",
};
