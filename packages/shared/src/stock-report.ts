export const STOCK_VALUE_BASIS_OPTIONS = [
  { value: "none", label: "Não exibir valor" },
  { value: "last_cost", label: "Último preço de custo" },
  { value: "avg_sale", label: "Preço médio de venda" },
  { value: "default_sale", label: "Preço padrão de venda" },
] as const;

export type StockValueBasis = (typeof STOCK_VALUE_BASIS_OPTIONS)[number]["value"];

export const STOCK_VALUE_PRICE_COLUMN_LABELS: Record<
  Exclude<StockValueBasis, "none">,
  string
> = {
  last_cost: "Último Preço de Custo",
  avg_sale: "Preço Médio de Venda",
  default_sale: "Preço Padrão de Venda",
};

export function isStockValueBasis(v: string): v is StockValueBasis {
  return STOCK_VALUE_BASIS_OPTIONS.some((o) => o.value === v);
}

export const STOCK_SITUATION_OPTIONS = [
  { value: "with_stock", label: "Somente itens com estoque" },
  { value: "all", label: "Incluir itens sem estoque" },
] as const;

export type StockSituation =
  (typeof STOCK_SITUATION_OPTIONS)[number]["value"];

export const STOCK_COUNT_SORT_OPTIONS = [
  { value: "supplier", label: "Fornecedor" },
  { value: "name", label: "Ordem alfabética (nome)" },
  { value: "sku", label: "Código interno" },
] as const;

export type StockCountSortBy =
  (typeof STOCK_COUNT_SORT_OPTIONS)[number]["value"];

export function isStockSituation(v: string): v is StockSituation {
  return STOCK_SITUATION_OPTIONS.some((o) => o.value === v);
}

export function isStockCountSortBy(v: string): v is StockCountSortBy {
  return STOCK_COUNT_SORT_OPTIONS.some((o) => o.value === v);
}
