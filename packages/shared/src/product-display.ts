const SALE_UNIT_LABELS: Record<string, string> = {
  UN: "Unidade",
  CX: "Caixa",
  FD: "Fardo",
};

export function formatProductUnitLabel(
  attributes?: Record<string, unknown> | null,
): string | null {
  if (!attributes || typeof attributes !== "object") return null;

  const net = attributes.net_content;
  if (typeof net === "string" && net.trim()) return net.trim();

  const saleUnit = attributes.sale_unit;
  if (typeof saleUnit === "string" && saleUnit.trim()) {
    return SALE_UNIT_LABELS[saleUnit.trim()] ?? saleUnit.trim();
  }

  return null;
}

export function formatProductPriceWithUnit(
  price: number,
  attributes?: Record<string, unknown> | null,
): string {
  const money = `R$ ${price.toFixed(2)}`;
  const unit = formatProductUnitLabel(attributes);
  return unit ? `${money} · ${unit}` : money;
}

export function formatProductStockLabel(stockQty: number): string {
  if (stockQty <= 0) return "Sem estoque";
  if (stockQty === 1) return "1 em estoque";
  return `${stockQty} em estoque`;
}

export function isProductSaleBlockedByStock(
  stockQty: number,
  blockSaleWhenOutOfStock: boolean,
): boolean {
  return blockSaleWhenOutOfStock && stockQty <= 0;
}

/** Rótulo amigável: nome (+ código/SKU opcional). */
export function formatProductStockItemLabel(
  name: string,
  code?: string | null,
): string {
  const label = name.trim() || "produto";
  const c = typeof code === "string" ? code.trim() : "";
  return c ? `${label} (${c})` : label;
}

/** Estoque zerado / acabou. */
export function formatOutOfStockMessage(
  name: string,
  code?: string | null,
): string {
  return `O item ${formatProductStockItemLabel(name, code)} está sem estoque disponível.`;
}

/** Quantidade pedida maior que o disponível (ainda > 0). */
export function formatInsufficientStockMessage(
  name: string,
  available: number,
  requested: number,
  code?: string | null,
): string {
  if (available <= 0) return formatOutOfStockMessage(name, code);
  const label = formatProductStockItemLabel(name, code);
  return `O item ${label} não tem estoque suficiente (disponível: ${available}, solicitado: ${requested}).`;
}
